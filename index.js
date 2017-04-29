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
	, SEMVER_VALUES = [ SEMVER_PATCH, SEMVER_MINOR, SEMVER_MAJOR ]
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

	// Implementation

	function out( m ) {
		process.stdout.write( m );
	}

	function err( m ) {
		process.stderr.write( m );
	}

	function line() {
		out( '\n' );
	}

	let prepend = ( a ) => ( b ) => a + b;
	let append = ( b ) => ( a ) => a + b;

	let prefix = ( x ) => prepend( x + ' ' );
	let newline = append( '\n' );

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
		out( combine( m, prefix( '>' ), chalk.cyan ) + '\n' );
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
	let handleError = ( message ) => {
		return ( err ) => {
			throw err.code === 128 ? new ProcedureError( message ) : err;
		};
	};
	await execute( 'git status', false ).catch( handleError( 'Not a valid Git repository.' ) );
	await execute( 'git rev-parse HEAD', false ).catch( handleError( 'Git repository seems to be empty, please commit some changes first.' ) );
	await execute( 'git rev-parse master', false ).catch( handleError( 'Missing branch master, please create it on the first commit of the repository.' ) );
	await execute( 'git rev-parse develop', false ).catch( handleError( 'Missing branch develop, please branch it off master and use that for development.' ) );
}

async function validateNpmPackage() {
	if ( !fs.existsSync( 'package.json' ) )
		throw new ProcedureError( `Folder doesn't seem to contain a valid NPM package.` );
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

async function countDiffCommits() {
	return execute( `git rev-list --count --right-only master...develop`, false ).then( parseInt );
}

async function countDiffFiles() {
	return execute( 'git log master..develop --oneline', false ).then( countLines );
}

function countLines( contents ) {
	if ( contents.length === 0 ) return 0;
	for ( var count = -1, index = 0; index != -1; count++, index = contents.indexOf( '\n', index + 1 ) );
	return count;
}

async function isRepositoryClean() {
	// Removed, as this would return the wrong value in some cases: http://stackoverflow.com/a/2659808/90006
	// return execute( 'git diff-index --quiet HEAD --', false ).then( () => true, () => false );
	return Bluebird.all( [
		execute( 'git diff-index --quiet --cached HEAD', false ).then( () => true, () => false ),
		execute( 'git diff-files --quiet', false ).then( () => true, () => false )
	] ).spread( ( diffIndex, diffFiles ) => diffIndex && diffFiles );
}

async function askVersionType( currentVersion ) {
	let questions = [
		{
			name: 'type',
			type: 'list',
			message: 'Please select versioning type:',
			choices: SEMVER_VALUES
		}, {
			name: 'confirm',
			type: 'confirm',
			message: ( answers ) => `This will update this module to version: ${ semver.inc( currentVersion, answers.type ) }. Confirm? `,
			default: true
		}
	];

	return inquirer
		.prompt( questions )
		.then( ( answers ) => answers.confirm ? answers.type : null );
}

async function askForChangelog( versionType, versionNumber ) {

	let questions = [
		{
			name: 'change',
			type: 'confirm',
			message: 'Do you wish to update the changelog?',
			when: versionType === SEMVER_PATCH || versionType === SEMVER_MINOR,
			default: versionType === SEMVER_MINOR
		}, {
			name: 'entry',
			type: 'editor',
			message: 'Please write the contents of the update',
			when: ( answers ) => versionType === SEMVER_MAJOR || answers.change,
			default: `## v${ versionNumber } (${ moment().format( 'YYYY/MM/DD' ) })\n- Entry 1\n- Entry 2`
		}
	];

	return inquirer.prompt( questions ).then( answers => answers.entry );

}

function writeChangelogEntry( entry ) {

	let content = '', newline = '\n';
	if ( fs.existsSync( 'CHANGELOG.md' ) ) {
		content = fs.readFileSync( 'CHANGELOG.md', 'UTF-8' );
	}

	fs.writeFileSync( 'CHANGELOG.md', newline + entry + content );

}

async function activate() {

	let LINE_LENGHT = 40;
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

	logger.line();

	let APP_VERSION = await getAppVersion();
	logger.title( _.pad( `Welcome to Version Generator v${ APP_VERSION }`, LINE_LENGHT ) );

	await validateGitRepository();

	await validateNpmPackage();

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

	let VERSION = await getLatestTag(), tagFound = false;
	if ( VERSION ) {
		log( `Latest tag found:`, VERSION );
		tagFound = true;
	} else {
		VERSION = '0.0.0';
		log( `Latest tag found:`, '---', 'warn' );
	}

	if ( tagFound && !semver.valid( VERSION ) )
		throw new ProcedureError( 'Invalid tag found according to SEMVER. Please tag your releases using semver.' );

	let PACKAGE_VERSION = await getPackageVersion();
	log( `Package version:`, PACKAGE_VERSION );

	if ( !semver.valid( PACKAGE_VERSION ) )
		throw new ProcedureError( 'Invalid package version according to SEMVER. Please package your releases using semver.' );

	if ( !tagFound ) {
		VERSION = PACKAGE_VERSION;
	} else {
		let sv = semver( VERSION ), sp = semver( PACKAGE_VERSION );
		if ( sv.major !== sp.major || sv.minor !== sp.minor || sv.patch !== sp.patch )
			throw new ProcedureError( `Version mismatched, please tag version ${ PACKAGE_VERSION } on your Git repository.` );
		VERSION = PACKAGE_VERSION;
	}

	let UNTRACKED = await countUntrackedFiles();
	log( `Untracked files detected:`, UNTRACKED, UNTRACKED > 0 ? 'warn' : 'info' );

	let DIFF_COMMITS = await countDiffCommits();
	log( `Commits since last release:`, DIFF_COMMITS, DIFF_COMMITS === 0 ? 'warn' : 'info' );

	if ( DIFF_COMMITS === 0 )
		// There are no commits between master and develop -> throw exception
		throw new ProcedureError( 'No commits detected since last version.' );

	let DIFF_FILES = await countDiffFiles();
	log( `Files changed since last release:`, DIFF_FILES, DIFF_FILES === 0 ? 'warn' : 'info' );

	if ( DIFF_FILES === 0 )
		// There are no changes between master and develop -> throw exception
		throw new ProcedureError( 'No changes detected since last version.' );

	// TODO: Show the list of commits that would be added. Should be disabled by default.
	// git log master..develop --oneline


	if ( !fs.existsSync( 'CHANGELOG.md' ) ) {
		logger.line();
		logger.warn( 'Changelog file missing, it is suggested to create it.' );
	}

	logger.line();

	let VERSION_TYPE = await askVersionType( VERSION );
	if ( !VERSION_TYPE )
		throw new ProcedureError( 'Operation aborted by the user.' );

	let NEXT_VERSION = semver.inc( VERSION, VERSION_TYPE );

	let CHANGELOG = await askForChangelog( VERSION_TYPE, NEXT_VERSION );

	//
	// From here we start modifying the Git repository.
	// Should somehow rollback on failure.
	//
	// Flow:
	// - Create new branch 'releases/vX' for this release.
	// - Finalize CHANGELOG.md
	// - Update package.json
	// - Switch to master and merge 'releases/vX'
	// - Tag this version
	// - Switch to develop and merge 'releases/vX'

	logger.line();

	let RELEASE_BRANCH = `releases/${ NEXT_VERSION}`;
	let RELEASE_TAG = `v${ NEXT_VERSION }`;

	if ( CHANGELOG ) {
		writeChangelogEntry( CHANGELOG );

		logger.info( 'Changelog updated.' );
		logger.line();

		await execute( `git checkout -b ${ RELEASE_BRANCH }` );
		await execute( `git add CHANGELOG.md` );
		await execute( `git commit -m "Updated changelog for v${ NEXT_VERSION }"` );
	} else {
		await execute( `git checkout -b ${ RELEASE_BRANCH }` );
	}

	await execute( `npm version ${ VERSION_TYPE } --git-tag-version=false` );
	await execute( `git add package.json` );
	await execute( `git commit -m "${ NEXT_VERSION }"` );
	await execute( `git checkout master` );
	await execute( `git merge --no-ff ${ RELEASE_BRANCH }` );
	await execute( `git tag ${ RELEASE_TAG }` );
	await execute( `git checkout develop` );
	await execute( `git merge --no-ff ${ RELEASE_BRANCH }` );
	await execute( `git branch -d ${ RELEASE_BRANCH }` );

	logger.line();

	logger.info( `Versioning complete.` );
	logger.info( `Project updated to version: ${ NEXT_VERSION }.` );
	logger.info( `To publish your changes to the npm repository, use:`, 'npm publish' );
	logger.info( `To synchronize your changes to the git origin repository, use:`, `git push origin master develop ${ RELEASE_TAG }` );

	return true;

}

Bluebird
	.try( activate )
	.then( () => process.exit( 0 ) )
	.catch( ( err ) => {
		logger.line();
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
