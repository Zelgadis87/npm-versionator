
const Bluebird = extendBluebird( require( 'bluebird' ) )
	, _ = require( 'lodash' )
	, semver = require( 'semver' )
	, process = require( 'process' )
	, inquirer = extendInquirer( require( 'inquirer' ) )
	, fs = Bluebird.promisifyAll( require( 'fs' ) )
	, moment = require( 'moment' )
	, chalk = require( 'chalk' )
	, yargs = require( 'yargs' ).argv

	, logger = require( './logger.js' )
	, npm = require( './npm.js' )
	, git = require( './git.js' )
	, execute = require( './execute.js' )
	, ProcedureError = require( './utils.js' ).ProcedureError
	;

const LINE_LENGHT = 45;

const SEMVER_PATCH = 'patch'
	, SEMVER_MINOR = 'minor'
	, SEMVER_MAJOR = 'major'
	, SEMVER_PRE_MAJOR = 'premajor'
	, SEMVER_PRE_MINOR = 'preminor'
	, SEMVER_PRE_PATCH = 'prepatch'
	, SEMVER_PRE_RELEASE = 'prerelease'
	;

let APP_VERSION,
	BRANCH,
	EVERYTHING_COMMITTED,
	LAST_TAG,
	PACKAGE_VERSION,
	VERSION,
	IS_PRERELEASE_VERSION,
	UNTRACKED,
	DIFF_COMMITS,
	DIFF_MASTER_COMMITS,
	DIFF_FILES,
	DIFF_MASTER_FILES,
	PRERELEASE_TYPE,
	PRERELEASE_IDENTIFIER,
	PRERELEASE_NUMBER,
	MAJOR,
	MINOR,
	PATCH,
	REMOTE_REPOSITORIES,
	ALLOW_RELEASE,
	ALLOW_PRERELEASE
	;

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

function announceAndExecuteAsync( cmd ) {
	return Bluebird
		.resolve( cmd )
		.tap( logger.command )
		.then( execute );
}

async function askVersionType( currentVersion, diffFiles ) {

	let isPrerelease = currentVersion.indexOf( '-' ) > -1;
	let major = semver.major( currentVersion );
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
				prerelease,
				versionChoice( 'New patch version', SEMVER_PATCH ),
				versionChoice( 'New minor version', SEMVER_MINOR ),
				versionChoice( 'New major version', SEMVER_MAJOR )
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

async function start() {

	//
	// ----------------------------------------------------
	// Intro section
	// ----------------------------------------------------
	// We show the name and version of this application.
	//

	logger.line();

	APP_VERSION = await npm.getVersion();
	logger.title( _.pad( `Welcome to Version Generator v${ APP_VERSION }`, LINE_LENGHT ) );

	//
	// ----------------------------------------------------
	// Initial checks
	// ----------------------------------------------------
	// We require a valid Git repository.
	// We require a valid NPM project.
	//

	logger.line();

	await git.validate();
	await npm.validate();

	//
	// ----------------------------------------------------
	// Status section
	// ----------------------------------------------------
	// We inform the user about the project status.
	//

	logger.line();

	BRANCH = await git.getCurrentBranch();
	log( `You currently are on branch:`, BRANCH );

	EVERYTHING_COMMITTED = await git.isRepositoryClean();

	LAST_TAG = await git.getLatestVersionTag();
	let tagFound = false;
	if ( LAST_TAG ) {
		log( `Latest tag found:`, LAST_TAG );
		tagFound = true;
	} else {
		LAST_TAG = '0.0.0';
		log( `Latest tag found:`, '---', 'warn' );
	}

	if ( tagFound && !semver.valid( LAST_TAG ) )
		throw new ProcedureError( 'Invalid tag found according to SEMVER. Please tag your releases using semver.' );

	PACKAGE_VERSION = await npm.getVersion();
	log( `Package version:`, PACKAGE_VERSION );

	if ( !tagFound ) {
		VERSION = PACKAGE_VERSION;
	} else {
		let sv = semver( LAST_TAG ), sp = semver( PACKAGE_VERSION );
		if ( sv.major !== sp.major || sv.minor !== sp.minor || sv.patch !== sp.patch )
			throw new ProcedureError( `Version mismatched, your Git repository and NPM package have diverged.\nPlease tag version ${ PACKAGE_VERSION } on your Git repository:`, `git tag ${ PACKAGE_VERSION } <commit_id>` );
		VERSION = LAST_TAG;
	}

	let match = LAST_TAG.match( /-(alpha|beta|rc)\.([0-9])+$/ );
	IS_PRERELEASE_VERSION = match !== null;
	[ PRERELEASE_IDENTIFIER, PRERELEASE_NUMBER ] = match ? [ match[1], match[2] ] : [ null, null ];

	if ( IS_PRERELEASE_VERSION )
		log( `Prerelease information:`, `${ PRERELEASE_IDENTIFIER } ${ parseInt( PRERELEASE_NUMBER ) }`, 'info' );

	UNTRACKED = await git.countUntrackedFiles();
	log( `Untracked files detected:`, UNTRACKED, UNTRACKED > 0 ? 'warn' : 'info' );

	DIFF_COMMITS = await git.countDiffCommits( tagFound ? LAST_TAG : 'master' );
	log( `Commits since ${ VERSION }:`, DIFF_COMMITS, DIFF_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	DIFF_MASTER_COMMITS = await git.countDiffCommits( 'master' );
	if ( DIFF_MASTER_COMMITS !== DIFF_COMMITS )
		log( `Commits since last stable release:`, DIFF_MASTER_COMMITS, DIFF_MASTER_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	DIFF_FILES = await git.countDiffFiles( tagFound ? LAST_TAG : 'master' );
	log( `Files changed since ${ VERSION }:`, DIFF_FILES, DIFF_FILES === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	DIFF_MASTER_FILES = await git.countDiffFiles( 'master' );
	if ( DIFF_MASTER_FILES !== DIFF_FILES )
		log( `Files changed since last stable release:`, DIFF_MASTER_COMMITS, DIFF_MASTER_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

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

	REMOTE_REPOSITORIES = await git.getRemoteRepositories();
	if ( REMOTE_REPOSITORIES.length === 0 ) {
		logger.warn( 'No remote repository found.' );
		logger.warn( '  Add one with:', 'git remote add <name> <url>' );
	}

	if ( !fs.existsSync( '.gitignore' ) )
		logger.warn( '.gitignore file missing, it is suggested to create it before committing unwanted files.' );
	if ( !fs.existsSync( 'CHANGELOG.md' ) )
		logger.warn( 'CHANGELOG.md file missing, it is suggested to create it before a public release.' );
	if ( !fs.existsSync( 'README.md' ) )
		logger.warn( 'README.md file missing, it is suggested to create it before a public release.' );
	if ( !fs.existsSync( 'LICENSE' ) )
		logger.warn( 'LICENSE file missing, it is suggested to create it before a public release.' );

	let actionsRequired = getActionsRequiredToVersionate();

	if ( actionsRequired.length > 0 ) {

		logger.warn( 'Cannot create a new version in the current state' );
		logger.warn( actionsRequired[0], actionsRequired[1] );
		logger.line();


	} else {

		ALLOW_RELEASE = ( DIFF_COMMITS === 0 && IS_PRERELEASE_VERSION ) || ( DIFF_COMMITS > 0 && !IS_PRERELEASE_VERSION );
		ALLOW_PRERELEASE = DIFF_COMMITS > 0;

		MAJOR = semver.major( VERSION );
		MINOR = semver.minor( VERSION );
		PATCH = semver.patch( VERSION );
		PRERELEASE_TYPE = IS_PRERELEASE_VERSION ? ( PATCH === 0 ? ( MINOR === 0 ? SEMVER_MAJOR : SEMVER_MINOR ) : SEMVER_PATCH ) : null;

	}

	//
	// ----------------------------------------------------
	// Choice selection
	// ----------------------------------------------------
	// We select which actions are available to the user
	//

	logger.line();

	await main();

}

function main() {

	let choices = [];

	let semverFormat = ( message, type, identifier = '' ) => `${ message } ( ${ chalk.cyan.bold( semver.inc( VERSION, type, identifier ) ) } )`;
	let versionChoice = ( key, message, versionType, versionIdentifier ) => {
		return {
			key: key,
			name: semverFormat( message, versionType, versionIdentifier ),
			version: semver.inc( VERSION, versionType, versionIdentifier ),
			value: () => versionate( versionType, versionIdentifier )
		};
	};

	if ( ALLOW_PRERELEASE ) {

		let isAlpha = PRERELEASE_IDENTIFIER === 'alpha',
			isBeta =  PRERELEASE_IDENTIFIER === 'beta',
			isRC = PRERELEASE_IDENTIFIER === 'rc';

		if ( IS_PRERELEASE_VERSION && !isAlpha && !isBeta && !isRC )
			choices.push( versionChoice( 'a', 'Switch to Alpha', SEMVER_PRE_RELEASE, 'alpha' ) );

		if ( isAlpha )
			choices.push( versionChoice( 'a', 'New alpha version', SEMVER_PRE_RELEASE, 'alpha' ) );
		else if ( isBeta )
			choices.push( versionChoice( 'b', 'New beta version', SEMVER_PRE_RELEASE, 'beta' ) );
		else if ( isRC )
			choices.push( versionChoice( 'c', 'New release candidate', SEMVER_PRE_RELEASE, 'rc' ) );

		if ( IS_PRERELEASE_VERSION && !isRC )
			choices.push( versionChoice( 'r', `Release as stable`, PRERELEASE_TYPE ) );

	}

	if ( ALLOW_RELEASE ) {
		if ( IS_PRERELEASE_VERSION ) {
			choices.push( versionChoice( 'r', `Release as stable`, PRERELEASE_TYPE ) );
		} else {
			choices.push( versionChoice( 'p', `Release as patch version`, SEMVER_PATCH ) );
			choices.push( versionChoice( 'm', `Release as minor version`, SEMVER_MINOR ) );
			choices.push( versionChoice( 'M', `Release as major version`, SEMVER_MAJOR ) );
		}
	}

	// TODO: Show the list of commits that would be added. Should be disabled by default.
	// git log master..develop --oneline

	return inquirer.prompt( {
		name: 'value',
		type: 'list',
		message: 'Select the action to execute.',
		choices: choices
	} ).then( answers => answers.value() );

}

function getActionsRequiredToVersionate() {

	if ( !semver.valid( PACKAGE_VERSION ) )
		// Not a SemVer package
		return [ 'Package is in an invalid version according to SemVer.' ];

	if ( !EVERYTHING_COMMITTED )
		// There are some files yet to be commited
		return [ 'Repository not clean, please commit all your files before proceeding:', 'git commit -a' ];

	if ( BRANCH !== 'develop' )
		// We are on an invalid branch
		return [ 'Please move to the DEVELOP branch first:', 'git checkout develop' ];

	if ( DIFF_COMMITS === 0 && !IS_PRERELEASE_VERSION )
		// There are no commits between master and develop
		return [ 'No commits detected since last version.' ];

	if ( DIFF_FILES === 0 && !IS_PRERELEASE_VERSION )
		// There are no changes between master and develop
		return [ 'No changes detected since last version.' ];

	return [];

}

async function versionate( versionType, versionIdentifier = '' ) {

	//
	// ----------------------------------------------------
	// Tests section
	// ----------------------------------------------------
	// We run the configured NPM test tasks.
	// If any of these fails, we abort the process.
	//

	logger.line();

	await npm.test().catch( () => { throw new ProcedureError( 'Tests failed.' ); } );
	logger.info( 'All tests passed.' );

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

	// let [ VERSION_TYPE, PRERELEASE_IDENTIFIER ] = await askVersionType( VERSION, DIFF_FILES );

	let NEXT_VERSION = semver.inc( VERSION, versionType, PRERELEASE_IDENTIFIER );

	let IS_UNSTABLE = _.includes( [ SEMVER_PRE_PATCH, SEMVER_PRE_MINOR, SEMVER_PRE_MAJOR, SEMVER_PRE_RELEASE ], versionType );

	let CHANGELOG = await askForChangelog( versionType, NEXT_VERSION );

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
		await announceAndExecuteAsync( `git checkout -b ${ RELEASE_BRANCH }` );

	if ( CHANGELOG ) {
		await announceAndExecuteAsync( `git add CHANGELOG.md` );
		await announceAndExecuteAsync( `git commit -m "Updated changelog for v${ NEXT_VERSION }"` );
		await announceAndExecuteAsync( `rm CHANGELOG.md.draft` );
	}

	await announceAndExecuteAsync( `npm version ${ NEXT_VERSION } --git-tag-version=false` );
	await announceAndExecuteAsync( `git add package.json` );
	await announceAndExecuteAsync( `git commit -m "${ NEXT_VERSION }"` );

	if ( !IS_UNSTABLE ) {
		await announceAndExecuteAsync( `git checkout master` );
		await announceAndExecuteAsync( `git merge --no-ff ${ RELEASE_BRANCH }` );
		await announceAndExecuteAsync( `git tag ${ RELEASE_TAG }` );

		await announceAndExecuteAsync( `git checkout develop` );
		await announceAndExecuteAsync( `git merge --no-ff ${ RELEASE_BRANCH }` );

		await announceAndExecuteAsync( `git branch -d ${ RELEASE_BRANCH }` );
	} else {
		await announceAndExecuteAsync( `git tag ${ RELEASE_TAG }` );
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

module.exports = start;