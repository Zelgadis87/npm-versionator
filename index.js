#!/usr/bin/env node

const Bluebird = extendBluebird( require( 'bluebird' ) )
	, _ = require( 'lodash' )
	, semver = require( 'semver' )
	, child_process = require( 'child_process' )
	, process = require( 'process' )
	, inquirer = extendInquirer( require( 'inquirer' ) )
	, fs = Bluebird.promisifyAll( require( 'fs' ) )
	, moment = require( 'moment' )
	, chalk = require( 'chalk' )
	, yargs = require( 'yargs' ).argv
	;

const SEMVER_PATCH = 'patch'
	, SEMVER_MINOR = 'minor'
	, SEMVER_MAJOR = 'major'
	, SEMVER_PRE_MAJOR = 'premajor'
	, SEMVER_PRE_MINOR = 'preminor'
	, SEMVER_PRE_PATCH = 'prepatch'
	, SEMVER_PRE_RELEASE = 'prerelease'
	;

function extendInquirer( inquirer ) {

	// Use VIM as default editor if no value is specified.
	process.env.EDITOR = process.env.EDITOR || 'vim';

	// Create a logger Writable stream
	// let Writable = require( 'stream' ).Writable;
	// let writableLogger = new Writable();
	// writableLogger._write = ( chunk, encoding, done ) => { logger.info( chunk.toString() ); done(); };

	// // Replace default inquirer prompt with a new one
	inquirer.prompt = inquirer.createPromptModule( /*{ output: writableLogger }*/ );

	return inquirer;

}

function extendBluebird( Bluebird ) {
	Bluebird.config( {
	// Enable warnings
		warnings: true,
	// Enable long stack traces
		longStackTraces: true,
	// Enable cancellation
		cancellation: true,
	// Enable monitoring
		monitoring: true
	} );
	return Bluebird;
}

let logger = ( function() {

	let me = this;

	// Interface
	me.info = info;
	me.error = error;
	me.warn = warn;
	me.line = line;
	me.command = command;
	me.title = title;
	me.out = out;

	// Implementation

	let isNewLine = false;

	function out( m ) {
		process.stdout.write( m );
	}

	function err( m ) {
		process.stderr.write( m );
	}

	function line( forced ) {
		if ( isNewLine && !forced )
			return;
		out( '\n' );
		isNewLine = true;
	}

	let prepend = ( a ) => ( b ) => a + b;
	let append = ( b ) => ( a ) => a + b;

	let prefix = ( x ) => prepend( x + ' ' );
	let newline = ( x ) => { isNewLine = false; return x + '\n'; };

	let combine = ( x, ...fns ) => ( x === null || x === undefined ) ? '' : _.flow( fns )( x );

	function info( m, c ) {
		out( combine( m, prefix( ' ' ), append( combine( c, prepend( ' ' ), chalk.cyan ) ), chalk.green, newline ) );
	}

	function warn( m, c ) {
		out( combine( m, prefix( ' ' ), append( combine( c, prepend( ' ' ), chalk.cyan ) ), chalk.yellow, newline ) );
	}

	function error( m, c ) {
		err( combine( m, prefix( ' ' ), append( combine( c, prepend( ' ' ), chalk.cyan ) ), chalk.red, chalk.bold, newline ) );
	}

	function command( m ) {
		out( combine( m, prefix( '>' ), chalk.cyan, newline ) );
	}

	function title( m ) {
		let hr = _.repeat( '-', m.length );
		info( hr );
		info( m );
		info( hr );
	}

	return me;

} )();

class ProcedureError extends Error {

	constructor( message, command ) {
		super( message );
		this.command = command;
	}

}

async function execute( cmd, showInConsole ) {
	return new Bluebird( ( resolve, reject ) => {
		if ( showInConsole !== false )
			logger.command( cmd );
		child_process.exec( cmd, ( err, stdout, stderr ) => {
			if ( err ) reject( err );
			else resolve( stdout.trim() );
		} );
	} );
}

async function getAppVersion() {
	return require( './package' ).version;
}

async function validateGitRepository() {
	let handleError = ( message, command = null ) => {
		return ( err ) => {
			throw err.code === 128 ? new ProcedureError( message, command ) : err;
		};
	};
	await execute( 'git status', false ).catch( handleError( 'Not a valid Git repository. To create a new repository, use:', 'git init' ) );
	await execute( 'git rev-parse HEAD', false ).catch( handleError( 'Git repository seems to be empty, please commit some changes first.' ) );
	await execute( 'git rev-parse master', false ).catch( handleError( 'Missing branch master, please create it on the first commit of the repository:', 'git branch master <first_commit_id>' ) );
	await execute( 'git rev-parse develop', false ).catch( handleError( 'Missing branch develop, please branch it off master and use that for development:', 'git checkout -b develop master' ) );
}

async function validateNpmPackage() {
	if ( !fs.existsSync( 'package.json' ) )
		throw new ProcedureError( `Folder doesn't seem to contain a valid NPM package. To create a new package, use:`, 'npm init' );
}

async function getLatestTag() {
	let latestVersion = null;
	let sha = await execute( 'git rev-list --tags=v*.*.* --max-count=1', false ).catch( ( err ) => {
		if ( err.code === 129 ) {
			// No tags found, return empty version.
			return null;
		}
		throw err;
	} );
	if ( sha ) {
		latestVersion = await execute( `git describe --tags ${ sha } --match=v*.*.*`, false );
	}
	return latestVersion;
}

async function getPackageVersion() {
	let packageContent = await fs.readFileAsync( 'package.json' );
	return JSON.parse( packageContent ).version;
}

async function getCurrentBranch() {
	return execute( 'git rev-parse --abbrev-ref HEAD', false )
		.then( ( name ) => {
			if ( name !== 'HEAD' )
				return name;
			return '*detached HEAD';
		} );
}

async function countUntrackedFiles() {
	return execute( 'git ls-files --exclude-standard --others', false ).then( countLines );
}

async function countDiffCommits( from ) {
	return execute( `git rev-list --count --right-only ${ from }...HEAD`, false ).then( parseInt );
}

async function countDiffFiles( from ) {
	return execute( `git diff --name-only ${ from }...HEAD`, false ).then( countLines );
}

function countLines( contents ) {
	let count = -1;
	if ( contents.length > 0 )
		for ( let index = 0; index != -1; count++, index = contents.indexOf( '\n', index + 1 ) );
	return count + 1;
}

async function isRepositoryClean() {
	// Removed, as this would return the wrong value in some cases: http://stackoverflow.com/a/2659808/90006
	// return execute( 'git diff-index --quiet HEAD --', false ).then( () => true, () => false );
	return Bluebird.all( [
		execute( 'git diff-index --quiet --cached HEAD', false ).then( () => true, () => false ),
		execute( 'git diff-files --quiet', false ).then( () => true, () => false )
	] ).spread( ( diffIndex, diffFiles ) => diffIndex && diffFiles );
}

async function getRemoteRepositories() {
	return execute( 'git remote', false ).then( output => output.length > 0 ? output.split( '\n' ) : [] );
}

async function npmTest() {

	let log = ( error, x, lineEnding = false ) => {
		if ( x === null || x === undefined )
			return;
		let lines = x.split( '\n' ),
			style = chalk.bold,
			newline = false;
		for ( let line of lines ) {
			if ( newline ) {
				logger.line( true );
				logLine();
			}
			logger.out( style( line ) );
			newline = true;
		}
	};
	let logLine = () => logger.out( chalk.cyan( '    ' ) );

	return new Bluebird( ( resolve, reject ) => {

		logger.info( 'Testing NPM package: ', 'npm test -- --color'  );
		logLine();

		let test = child_process.spawn( /^win/.test( process.platform ) ? 'npm.cmd' : 'npm', [ 'test', '--', '--color' ] );
		test.stdout.on( 'data', data => log( false, data.toString() ) );
		test.stderr.on( 'data', data => log( true, data.toString() ) );
		test.on( 'close', ( code ) => {
			logger.line( true );
			code === 0 ? resolve() : reject();
		} );

	} );
}

async function askVersionType( currentVersion, diffFiles ) {

	let isPrerelease = currentVersion.indexOf( '-' ) > -1;
	// let major = semver.major( currentVersion );
	let minor = semver.minor( currentVersion );
	let patch = semver.patch( currentVersion );

	let choice = ( n, v ) => { return { name : n, value: v }; };
	let semverFormat = ( name, type, identifier = '' ) => `${ name } ( ${ chalk.cyan.bold( semver.inc( currentVersion, type, identifier ) ) } )`;

	if ( isPrerelease ) {

		let prereleaseType = ( patch === 0 ? ( minor === 0 ? SEMVER_MAJOR : SEMVER_MINOR ) : SEMVER_PATCH );
		let isAlpha = isPrerelease && currentVersion.indexOf( '-alpha.' ) > -1;
		let isBeta = isPrerelease && currentVersion.indexOf( '-beta.' ) > -1;
		let isRC = isPrerelease && currentVersion.indexOf( '-rc.' ) > -1;

		let choices = [];

		if ( diffFiles === 0 ) {
			if ( isAlpha )
				choices.push( choice( semverFormat( 'Switch to Beta', SEMVER_PRE_RELEASE, 'beta' ), [ SEMVER_PRE_RELEASE, 'beta' ] ) );
			if ( isBeta || isAlpha )
				choices.push( choice( semverFormat( 'Switch to Release Candidate', SEMVER_PRE_RELEASE, 'rc' ), [ SEMVER_PRE_RELEASE, 'rc' ] ) );
			if ( isRC )
				choices.push( choice( semverFormat( 'Release this release candidate', prereleaseType ), [ prereleaseType ] ) );
		} else {

			if ( isAlpha )
				choices.push( choice( semverFormat( 'New alpha version', SEMVER_PRE_RELEASE ), [ SEMVER_PRE_RELEASE ] ) );
			else if ( isBeta )
				choices.push( choice( semverFormat( 'New beta version', SEMVER_PRE_RELEASE ), [ SEMVER_PRE_RELEASE ] ) );
			else if ( isRC )
				choices.push( choice( semverFormat( 'New release candidate', SEMVER_PRE_RELEASE ), [ SEMVER_PRE_RELEASE ] ) );

			if ( !isAlpha && !isBeta && !isRC )
				choices.push( choice( semverFormat( 'Switch to Alpha', SEMVER_PRE_RELEASE, 'alpha' ), [ SEMVER_PRE_RELEASE, 'alpha' ] ) );

			if ( !isBeta && !isRC )
				choices.push( choice( semverFormat( 'Switch to Beta', SEMVER_PRE_RELEASE, 'beta' ), [ SEMVER_PRE_RELEASE, 'beta' ] ) );

			if ( !isRC ) {
				choices.push( choice( semverFormat( 'Switch to Release Candidate', SEMVER_PRE_RELEASE, 'rc' ), [ SEMVER_PRE_RELEASE, 'rc' ] ) );
				choices.push( choice( semverFormat( `Complete prerelease ${ chalk.yellow( '(should use RC)' ) }`, prereleaseType ), [ prereleaseType ] ) );
			}

		}

		return inquirer.prompt( {
			name: 'value',
			type: 'list',
			message: 'You are currently in a prerelease version. How do you want to proceed?',
			choices: choices
		} ).then( answers => answers.value );

	} else {

		let askReleaseType = () => {
			let versionChoice = ( d, v ) => choice( semverFormat( d, v ), v );
			let prerelease = 'Prerelease version...';
			let choices = [
				versionChoice( 'New patch version', SEMVER_PATCH ),
				versionChoice( 'New minor version', SEMVER_MINOR ),
				versionChoice( 'New major version', SEMVER_MAJOR ),
				prerelease
			];
			return inquirer.prompt( {
				name: 'value',
				type: 'list',
				message: 'Start a new release:',
				choices: choices
			} ).then( answers => answers.value === prerelease ? askPrereleaseType() : [ answers.value ] );
		};

		let askPrereleaseType = () => {
			let preversionChoice = ( d, v ) => choice( semverFormat( d, v ), v );
			let option_back = '< Back';
			let choices = [
				option_back,
				preversionChoice( 'New pre-patch version', SEMVER_PRE_PATCH ),
				preversionChoice( 'New pre-minor version', SEMVER_PRE_MINOR ),
				preversionChoice( 'New pre-major version', SEMVER_PRE_MAJOR )
			];
			return inquirer.prompt( {
				name: 'value',
				type: 'list',
				message: 'Start a new prerelease:',
				choices: choices,
				default: 1
			} ).then( answers => answers.value === option_back ? askReleaseType() : askPrereleaseIdentifier( answers.value ) );
		};

		let askPrereleaseIdentifier = ( prereleaseType ) => {
			let identifierChoice = ( d, i ) => choice( semverFormat( d, prereleaseType, i ), i );
			let option_back = '< Back';
			let choices = [
				option_back,
				identifierChoice( 'Alpha', 'alpha' ),
				identifierChoice( 'Beta', 'beta' ),
				identifierChoice( 'Release Candidate', 'rc' )
			];
			return inquirer.prompt( {
				name: 'value',
				type: 'list',
				message: 'Choose prerelease type:',
				choices: choices,
				default: 1
			} ).then( answers => answers.value === option_back ? askPrereleaseType() : [ prereleaseType, answers.value ] );
		};

		return askReleaseType();

	}

}

async function askForChangelog( versionType, versionNumber ) {

	let questions = [
		{
			name: 'change',
			type: 'confirm',
			message: 'Do you wish to update the changelog?',
			when: versionType !== SEMVER_MAJOR,
			default: versionType === SEMVER_MINOR
		}, {
			name: 'entry',
			type: 'editor',
			message: 'Please write the contents of the update',
			when: ( answers ) => versionType === SEMVER_MAJOR || answers.change,
			default: `## v${ versionNumber } (${ moment().format( 'YYYY/MM/DD HH:mm' ) })\n- Entry 1\n- Entry 2`
		}
	];

	return inquirer.prompt( questions ).then( answers => answers.entry );

}

async function askForConfirmation( versionNumber ) {

	return inquirer.prompt( {
		name: 'confirm',
		type: 'confirm',
		message: `Are you sure you wish to update your package to version ${ chalk.cyan( versionNumber ) } ? ${ chalk.bold.yellow( 'This action cannot be easily undone.' ) }`,
		default: false
	} ).then( answers => answers.confirm );

}

function writeChangelogEntry( entry ) {

	let content = '', newline = '\n';
	if ( fs.existsSync( 'CHANGELOG.md' ) ) {
		content = fs.readFileSync( 'CHANGELOG.md', 'UTF-8' );
	}

	fs.writeFileSync( 'CHANGELOG.md', newline + entry + content );

}

async function activate() {

	let LINE_LENGHT = 45;
	let log = ( m, c, level = 'info' ) => {
		let doLog = logger[ level ];
		if ( m === null || m === undefined )
			return doLog( '' );
		if ( c === null || c === undefined )
			return doLog( m );
		let diff = Math.max( 0, LINE_LENGHT - ( m.toString().length + c.toString().length + 1 ) );
		if ( diff > 0 )
			c = _.repeat( ' ', diff ) + c;
		return doLog( m, c );
	};

	//
	// ----------------------------------------------------
	// Intro section
	// ----------------------------------------------------
	// We show the name and version of this application.
	//

	logger.line();

	let APP_VERSION = await getAppVersion();
	logger.title( _.pad( `Welcome to Version Generator v${ APP_VERSION }`, LINE_LENGHT ) );

	//
	// ----------------------------------------------------
	// Initial checks
	// ----------------------------------------------------
	// We require a valid Git repository.
	// We require a valid NPM project.
	//

	logger.line();

	await validateGitRepository();

	await validateNpmPackage();

	//
	// ----------------------------------------------------
	// Status section
	// ----------------------------------------------------
	// We inform the user about the project status.
	// If any of the settings is not correct, we abort.
	//

	logger.line();

	let BRANCH = await getCurrentBranch();
	log( `You currently are on branch:`, BRANCH );

	if ( BRANCH !== 'develop' )
		// We are on an invalid branch => throw exception
		throw new ProcedureError( 'Please move to the DEVELOP branch first:', 'git checkout develop' );

	let EVERYTHING_COMMITED = await isRepositoryClean();
	if ( !EVERYTHING_COMMITED )
		// There are some files yet to be commited => throw exception
		throw new ProcedureError( 'Repository not clean, please commit all your files before proceeding:', 'git commit -a' );

	let LAST_TAG = await getLatestTag(), tagFound = false;
	if ( LAST_TAG ) {
		log( `Latest tag found:`, LAST_TAG );
		tagFound = true;
	} else {
		LAST_TAG = '0.0.0';
		log( `Latest tag found:`, '---', 'warn' );
	}

	if ( tagFound && !semver.valid( LAST_TAG ) )
		throw new ProcedureError( 'Invalid tag found according to SEMVER. Please tag your releases using semver.' );

	let PACKAGE_VERSION = await getPackageVersion();
	log( `Package version:`, PACKAGE_VERSION );

	if ( !semver.valid( PACKAGE_VERSION ) )
		throw new ProcedureError( 'Invalid package version according to SEMVER. Please package your releases using semver.' );

	let VERSION;
	if ( !tagFound ) {
		VERSION = PACKAGE_VERSION;
	} else {
		let sv = semver( LAST_TAG ), sp = semver( PACKAGE_VERSION );
		if ( sv.major !== sp.major || sv.minor !== sp.minor || sv.patch !== sp.patch )
			throw new ProcedureError( `Version mismatched, please tag version ${ PACKAGE_VERSION } on your Git repository:`, `git tag ${ PACKAGE_VERSION } <commit_id>` );
		VERSION = LAST_TAG;
	}

	let match = LAST_TAG.match( /-(alpha|beta|rc)\.([0-9])+$/ );
	let IS_PRERELEASE_VERSION = match !== null;
	let [ PRERELEASE_TYPE, PRERELEASE_NUMBER ] = match ? [ match[1], match[2] ] : [ null, null ];

	if ( IS_PRERELEASE_VERSION )
		log( `Prerelease information:`, `${ PRERELEASE_TYPE } ${ parseInt( PRERELEASE_NUMBER ) }`, 'info' );

	let UNTRACKED = await countUntrackedFiles();
	log( `Untracked files detected:`, UNTRACKED, UNTRACKED > 0 ? 'warn' : 'info' );

	let DIFF_COMMITS = await countDiffCommits( tagFound ? LAST_TAG : 'master' );
	log( `Commits since ${ VERSION }:`, DIFF_COMMITS, DIFF_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	let DIFF_MASTER_COMMITS = await countDiffCommits( 'master' );
	if ( DIFF_MASTER_COMMITS !== DIFF_COMMITS )
		log( `Commits since last stable release:`, DIFF_MASTER_COMMITS, DIFF_MASTER_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	if ( DIFF_COMMITS === 0 && !IS_PRERELEASE_VERSION )
		// There are no commits between master and develop -> throw exception
		throw new ProcedureError( 'No commits detected since last version.' );

	let DIFF_FILES = await countDiffFiles( tagFound ? LAST_TAG : 'master' );
	log( `Files changed since ${ VERSION }:`, DIFF_FILES, DIFF_FILES === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	let DIFF_MASTER_FILES = await countDiffFiles( 'master' );
	if ( DIFF_MASTER_FILES !== DIFF_FILES )
		log( `Files changed since last stable release:`, DIFF_MASTER_COMMITS, DIFF_MASTER_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	if ( DIFF_FILES === 0 && !IS_PRERELEASE_VERSION )
		// There are no changes between master and develop -> throw exception
		throw new ProcedureError( 'No changes detected since last version.' );

	//
	// ----------------------------------------------------
	// Tests section
	// ----------------------------------------------------
	// We run the configured NPM test tasks.
	// If any of these fails, we abort the process.
	//

	logger.line();

	await npmTest().then( () => {
		logger.info( 'All tests passed.' );
	}, err => {
		throw new ProcedureError( 'Tests failed.' );
	} );

	//
	// ----------------------------------------------------
	// Warnings section
	// ----------------------------------------------------
	// We inform the user about any potential issues
	//   detected with its project setup.
	// At this point, all the required settings are correct
	//   so no more automatic failures should occur.
	//

	logger.line();

	let REMOTE_REPOSITORIES = await getRemoteRepositories();
	if ( REMOTE_REPOSITORIES.length === 0 ) {
		logger.warn( 'No remote repository found.' );
		logger.warn( '  Add one with:', 'git remote add <name> <url>' );
	}

	// TODO: Show the list of commits that would be added. Should be disabled by default.
	// git log master..develop --oneline

	if ( !fs.existsSync( '.gitignore' ) )
		logger.warn( '.gitignore file missing, it is suggested to create it before committing unwanted files.' );
	if ( !fs.existsSync( 'CHANGELOG.md' ) )
		logger.warn( 'CHANGELOG.md file missing, it is suggested to create it before a public release.' );
	if ( !fs.existsSync( 'README.md' ) )
		logger.warn( 'README.md file missing, it is suggested to create it before a public release.' );
	if ( !fs.existsSync( 'LICENSE' ) )
		logger.warn( 'LICENSE file missing, it is suggested to create it before a public release.' );

	//
	// ----------------------------------------------------
	// Input section
	// ----------------------------------------------------
	// We ask the user some questions
	//   about how it wants to proceed with the versioning.
	// We also ask if he wants this application
	//   to automatically update some of the project files.
	//

	logger.line();

	let [ VERSION_TYPE, PRERELEASE_IDENTIFIER ] = await askVersionType( VERSION, DIFF_FILES );

	let NEXT_VERSION = semver.inc( VERSION, VERSION_TYPE, PRERELEASE_IDENTIFIER );

	let IS_UNSTABLE = _.includes( [ SEMVER_PRE_PATCH, SEMVER_PRE_MINOR, SEMVER_PRE_MAJOR, SEMVER_PRE_RELEASE ], VERSION_TYPE );

	let CHANGELOG = await askForChangelog( VERSION_TYPE, NEXT_VERSION );

	if ( CHANGELOG )
		fs.writeFileSync( 'CHANGELOG.md.draft', CHANGELOG, 'UTF-8' );

	//
	// ----------------------------------------------------
	// Confirm section
	// ----------------------------------------------------
	// We ask the user for confirmation.
	// This is the last step before we proceed to modify
	//   the repository.
	//

	logger.line();

	let PROCEED = await askForConfirmation( NEXT_VERSION );
	if ( !PROCEED )
		throw new ProcedureError( 'Operation aborted by the user.' );

	//
	// ----------------------------------------------------
	// Flow section
	// ----------------------------------------------------
	// We modify the repository and metadata
	//   for the new version.
	// Since we are editing low-level files, we have no
	//   guarantee that all passes could be completed.
	//
	// TODO: We should however try our best to rollback
	//   the changes if something happens.
	//
	// Flow:
	// - Create new branch 'releases/vX' for this release.
	// - Finalize CHANGELOG.md
	// - Update package.json
	// - Switch to master and merge 'releases/vX'
	// - Tag this version
	// - Switch to develop and merge 'releases/vX'


	logger.line( true );

	let RELEASE_BRANCH = `releases/${ NEXT_VERSION}`;
	let RELEASE_TAG = `v${ NEXT_VERSION }`;

	if ( CHANGELOG ) {
		writeChangelogEntry( CHANGELOG );

		logger.info( 'Changelog updated.' );
		logger.line();
	}

	if ( !IS_UNSTABLE )
		await execute( `git checkout -b ${ RELEASE_BRANCH }` );

	if ( CHANGELOG ) {
		await execute( `git add CHANGELOG.md` );
		await execute( `git commit -m "Updated changelog for v${ NEXT_VERSION }"` );
		await execute( `rm CHANGELOG.md.draft` );
	}

	await execute( `npm version ${ NEXT_VERSION } --git-tag-version=false` );
	await execute( `git add package.json` );
	await execute( `git commit -m "${ NEXT_VERSION }"` );

	if ( !IS_UNSTABLE ) {
		await execute( `git checkout master` );
		await execute( `git merge --no-ff ${ RELEASE_BRANCH }` );
		await execute( `git tag ${ RELEASE_TAG }` );

		await execute( `git checkout develop` );
		await execute( `git merge --no-ff ${ RELEASE_BRANCH }` );

		await execute( `git branch -d ${ RELEASE_BRANCH }` );
	} else {
		await execute( `git tag ${ RELEASE_TAG }` );
	}

	//
	// ----------------------------------------------------
	// Output section
	// ----------------------------------------------------
	// All operations have been completed succesfully.
	// The user project has been updated to the
	//   requested version.
	// We update the user on how it might want to proceed
	//   to release the new version of its project.
	//

	logger.line();

	logger.info( `Versioning complete.` );
	logger.info( `Project updated to version: ${ NEXT_VERSION }.` );

	if ( REMOTE_REPOSITORIES.length > 1 ) {
		logger.info( `To synchronize your changes to the configured Git repositories, use:` );
		for ( let rep of REMOTE_REPOSITORIES ) {
			logger.info( `  for ${ rep }:`, `git push ${ rep } master develop ${ RELEASE_TAG }` );
		}
	} else if ( REMOTE_REPOSITORIES.length === 1 ) {
		let rep = REMOTE_REPOSITORIES[0];
		logger.info( `To synchronize your changes to the ${ rep } Git repository, use:`, `git push ${ rep } master develop ${ RELEASE_TAG }` );
	}

	if ( IS_UNSTABLE ) {
		logger.info( `To publish your unstable changes to the npm repository, use:`, 'npm publish --tag=unstable' );
	} else {
		logger.info( `To publish your changes to the npm repository, use:`, 'npm publish --tag=latest' );
	}

	return true;

}

Bluebird
	.try( activate )
	.then( () => process.exit( 0 ) )
	.catch( ( err ) => {
		logger.line( true );
		if ( err instanceof ProcedureError ) {
			logger.error( err.message, err.command );
		} else {
			logger.error( 'An unexpected error has occured:' );
			if ( yargs.verbose ) {
				logger.error( err.stack );
			} else {
				logger.error( err.message );
			}
		}
		logger.error( 'Execution aborted.' );
		process.exit( 1 );
	} )
	;
