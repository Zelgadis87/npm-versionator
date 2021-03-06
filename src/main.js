
const Bluebird = extendBluebird( require( 'bluebird' ) )
	, _ = require( 'lodash' )
	, semver = require( 'semver' )
	, process = require( 'process' )
	, os = require( 'os' )
	, fs = Bluebird.promisifyAll( require( 'fs' ) )
	, moment = require( 'moment' )
	, chalk = require( 'chalk' )

	, console = require( './my-console.js' )
	, npm = require( './npm.js' )
	, git = require( './git.js' )
	, execute = require( './execute.js' )
	, spawn = require( './spawn.js' )
	, ProcedureError = require( './utils.js' ).ProcedureError
	;

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
	IS_UNSTABLE,
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
	RELEASE_BRANCH,
	RELEASE_TAG,
	FIXUP_COMMITS,
	REMOTE_REPOSITORIES,
	ALLOW_RELEASE,
	ALLOW_PRERELEASE,
	VERSION_DONE,
	NEXT_VERSION,
	TASKS = [],
	debugOpts = {}
	;

let log = ( m, c, level = 'info' ) => {
	let doLog = console[ level ];
	if ( m === null || m === undefined )
		return doLog( '' );
	if ( c === null || c === undefined )
		return doLog( m );
	let diff = Math.max( 0, console.lineLength - ( m.toString().length + c.toString().length + 1 ) );
	if ( diff > 0 )
		c = _.repeat( ' ', diff ) + c;
	return doLog( m, c );
};

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
		.tap( console.command )
		.then( execute );
}

function announceAndSpawnAsync( cmd ) {
	return Bluebird
		.resolve( cmd )
		.tap( console.command )
		.tap( console.line )
		.tap( console.line )
		.then( spawn );
}

async function askForChangelog( versionType, versionNumber ) {

	console.line();
	console.info( 'Here are the commits for this release:' );
	console.line();
	await showGitLog( LAST_TAG, 'HEAD' );
	console.line();

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
			default: `## v${ versionNumber } (${ moment().format( 'YYYY/MM/DD HH:mm' ) })${ os.EOL }- Entry 1${ os.EOL }- Entry 2${ os.EOL }`
		}
	];

	return console.prompt( questions )
		.then( answers => answers.entry )
		.then( entry => {
			if ( entry ) {
				// Wait for the editor to fully close before returning the value
				// This is a workaround to avoid an issue with inquirer asking this question right before another.
				// Without the delay, when the editor closes, the next questions is asked but the process immediately exits afterwards.
				return Bluebird.resolve( entry ).delay( 250 );
			}
			return Bluebird.resolve( entry );
		} );

}

async function askForConfirmation( versionNumber ) {

	return console.prompt( {
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

	fs.writeFileSync( 'CHANGELOG.md', newline + entry.trim() + newline + content );

}

async function start( yargs ) {

	debugOpts.FAIL_ON_VERSION_MISMATCH = yargs.failOnVersionMismatch !== false;
	debugOpts.FAIL_ON_DIRTY_DIRECTORY = yargs.failOnDirtyDirectory !== false;
	debugOpts.FAIL_ON_INVALID_BRANCH = yargs.failOnInvalidBranch !== false;

	//
	// ----------------------------------------------------
	// Intro section
	// ----------------------------------------------------
	// We show the name and version of this application.
	// We also listen for graceful process termination.
	//

	process.on( 'SIGINT', function() {
		console.println();
		console.title( _.padEnd( `User aborted operation.`, console.lineLength ), console.error );
		console.println();
		process.exit( 0 );
	} );

	console.line();

	APP_VERSION = await npm.getVersion();
	console.title( _.pad( `Welcome to Version Generator v${ APP_VERSION }`, console.lineLength ) );

	await main();

}

async function main() {

	//
	// ----------------------------------------------------
	// Initial checks
	// ----------------------------------------------------
	// We require a valid Git repository.
	// We require a valid NPM project.
	//

	console.line();

	await git.validate();
	await npm.validate();

	//
	// ----------------------------------------------------
	// Status section
	// ----------------------------------------------------
	// We inform the user about the project status.
	//

	console.line();

	BRANCH = await git.getCurrentBranch();
	log( `You currently are on branch:`, BRANCH );

	EVERYTHING_COMMITTED = await git.isRepositoryClean();

	LAST_TAG = await git.getLatestVersionTag();
	let tagFound = false;
	if ( LAST_TAG ) {
		log( `Latest tag found:`, LAST_TAG );
		tagFound = true;
	} else {
		log( `Latest tag found:`, '---', 'warn' );
	}

	if ( tagFound && !semver.valid( LAST_TAG ) )
		throw new ProcedureError( 'Invalid tag found according to SEMVER. Please tag your releases using semver.' );

	PACKAGE_VERSION = await npm.readPackageVersion();
	log( `Package version:`, PACKAGE_VERSION );

	if ( !tagFound ) {
		VERSION = PACKAGE_VERSION;
		LAST_TAG = 'master';
	} else {
		let sv = semver.parse( LAST_TAG ), sp = semver.parse( PACKAGE_VERSION );
		if ( debugOpts.FAIL_ON_VERSION_MISMATCH && ( sv.major !== sp.major || sv.minor !== sp.minor || sv.patch !== sp.patch ) )
			throw new ProcedureError( `Version mismatched, your Git repository and NPM package have diverged.\nPlease tag version ${ PACKAGE_VERSION } on your Git repository:`, `git tag ${ PACKAGE_VERSION } <commit_id>` );
		VERSION = LAST_TAG;
	}

	let match = LAST_TAG.match( /-(alpha|beta|rc)\.([0-9])+$/ );
	IS_PRERELEASE_VERSION = match !== null;
	[ PRERELEASE_IDENTIFIER, PRERELEASE_NUMBER ] = match ? [ match[ 1 ], match[ 2 ] ] : [ null, null ];

	if ( IS_PRERELEASE_VERSION )
		log( `Prerelease information:`, `${ PRERELEASE_IDENTIFIER } ${ parseInt( PRERELEASE_NUMBER ) }`, 'info' );

	UNTRACKED = await git.countUntrackedFiles();
	log( `Untracked files detected:`, UNTRACKED, UNTRACKED > 0 ? 'warn' : 'info' );

	DIFF_COMMITS = await git.countDiffCommits( LAST_TAG );
	log( `Commits since ${ VERSION }:`, DIFF_COMMITS, DIFF_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	DIFF_MASTER_COMMITS = await git.countDiffCommits( 'master' );
	if ( DIFF_MASTER_COMMITS !== DIFF_COMMITS )
		log( `Commits since last stable release:`, DIFF_MASTER_COMMITS, DIFF_MASTER_COMMITS === 0 && !IS_PRERELEASE_VERSION ? 'warn' : 'info' );

	DIFF_FILES = await git.countDiffFiles( LAST_TAG );
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

	console.line();

	console.indent( '‼' );
	_.each( debugOpts, ( enabled, name ) => {
		if ( !enabled ) {
			console.warn( `Option ${ name } is disabled.` );
		}
	} );
	console.outdent();

	console.line();

	if ( EVERYTHING_COMMITTED ) {
		let logs = await git.log( LAST_TAG, 'HEAD' );
		FIXUP_COMMITS = logs.filter( l => l.fixup );
		if ( FIXUP_COMMITS.length ) {
			console.warn( `Found ${ FIXUP_COMMITS.length } fixup commits, which should be squashed before proceeding:`, `git rebase -i --autosquash ${ LAST_TAG }` );
			console.line();
			addTask( { id: 'fixup', message: 'Clean fixup commits', command: `git rebase -i --autosquash ${ LAST_TAG }`, interactive: 1, warning: 1 } );
		}
	} else {
		removeTask( 'fixup' );
	}

	REMOTE_REPOSITORIES = await git.getRemoteRepositories();
	if ( REMOTE_REPOSITORIES.length === 0 ) {
		console.warn( 'No remote repository found.' );
		console.warn( '  Add one with:', 'git remote add <name> <url>' );
	}

	if ( !fs.existsSync( '.gitignore' ) )
		console.warn( '.gitignore file missing, it is suggested to create it before committing unwanted files.' );
	if ( !fs.existsSync( 'CHANGELOG.md' ) )
		console.warn( 'CHANGELOG.md file missing, it is suggested to create it before a public release.' );
	if ( !fs.existsSync( 'README.md' ) )
		console.warn( 'README.md file missing, it is suggested to create it before a public release.' );
	if ( !fs.existsSync( 'LICENSE' ) )
		console.warn( 'LICENSE file missing, it is suggested to create it before a public release.' );

	let actionsRequired = getActionsRequiredToVersionate();

	if ( actionsRequired.length > 0 ) {

		console.warn( actionsRequired[ 0 ], actionsRequired[ 1 ] );
		console.line();

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

	console.line();

	await ask();

}

let choice = ( n, v, opts ) => { return _.extend( {}, opts, { name: n, value: v } ); };
let semverFormat = ( name, type, identifier = '' ) => `${ name } ( ${ chalk.cyan.bold( semver.inc( VERSION, type, identifier ) ) } )`;

function ask() {

	let logErrorThenAskAgain = e => {
		console.outdent( Number.MAX_SAFE_INTEGER );
		console.error( e );
		return ask();
	};

	let choices = [];

	if ( !VERSION_DONE ) {

		choices.push( choice( 'Create a new version', () => startReleaseProcess().then( ask, logErrorThenAskAgain ), { disabled: !ALLOW_RELEASE && !ALLOW_PRERELEASE } ) );

		choices.push( choice( 'Check again', main ) );

		if ( DIFF_COMMITS > 0 ) {
			choices.push( choice( `Show ${ DIFF_COMMITS } commits since ${ LAST_TAG }`, () => showGitLog( LAST_TAG, 'HEAD' ).then( ask, logErrorThenAskAgain ) ) );
		}

		if ( DIFF_MASTER_COMMITS > 0 && DIFF_MASTER_COMMITS !== DIFF_COMMITS ) {
			choices.push( choice( `Show ${ DIFF_MASTER_COMMITS } commits since last stable release`, () => showGitLog( 'master', 'HEAD' ).then( ask, logErrorThenAskAgain ) ) );
		}

		choices.push( choice( `Execute tests`, () => npmTest().then( ask, logErrorThenAskAgain ) ) );

	}

	if ( TASKS.length ) {

		console.line();
		console.info( "Remaining tasks: " );
		console.line();

		for ( let task of TASKS ) {
			console.task( task );
			if ( !task.done ) {
				choices.push( choice( task.message, () => {
					return Bluebird.resolve( task.command )
						.tap( console.line )
						.then( task.interactive ? announceAndSpawnAsync : announceAndExecuteAsync )
						.tap( console.line )
						.then( () => {
							task.done = true;
							return task.restart ? main() : ask();
						}, e => {
							console.error( e.message );
							return ask();
						} );
				} ) );
			}
		}

		console.line();

	}

	choices.push( choice( `Exit`, () => process.exit( 0 ) ) );

	return console.prompt( {
		name: 'value',
		type: 'list',
		message: 'Select the action to execute.',
		choices: choices
	} ).then( answers => answers.value() );

}

function startReleaseProcess() {
	return askReleaseType();
}

function completeReleaseProcess() {

	console.line();

	console.info( `Versioning complete.` );
	console.info( `Project updated to version: ${ NEXT_VERSION }.` );

	VERSION_DONE = true;

	if ( REMOTE_REPOSITORIES.length ) {
		for ( let rep of REMOTE_REPOSITORIES ) {
			addTask( {
				message: `Synchronize changes to the ${ rep } Git repository`,
				command: `git push ${ rep } master develop ${ RELEASE_TAG }`,
				interactive: 1
			} );
		}
	}

	addTask( {
		message: IS_UNSTABLE ? `Publish your unstable changes to the npm repository` : `Publish your changes to the npm repository`,
		command: `npm.cmd publish --tag=${ IS_UNSTABLE ? 'unstable' : 'latest' }`,
		interactive: 1
	} );

}


function askReleaseType() {

	let choices = [];

	let versionChoice = ( key, message, versionType, versionIdentifier ) => {
		return {
			key: key,
			name: semverFormat( message, versionType, versionIdentifier ),
			version: semver.inc( VERSION, versionType, versionIdentifier ),
			value: () => versionate( versionType, versionIdentifier )
		};
	};

	choices.push( choice( '< Back', ask ) );

	if ( ALLOW_PRERELEASE ) {

		let isAlpha = PRERELEASE_IDENTIFIER === 'alpha',
			isBeta = PRERELEASE_IDENTIFIER === 'beta',
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

		if ( !IS_PRERELEASE_VERSION )
			choices.push( { key: 'p', name: 'Start a prerelease...', value: askPrereleaseType } );

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

	return console.prompt( {
		name: 'value',
		type: 'list',
		message: 'Select release type.',
		default: 1,
		choices: choices
	} ).then( answers => answers.value() );

}

function askPrereleaseType() {
	let preversionChoice = ( d, v ) => choice( semverFormat( d, v ), v );
	let option_back = '< Back';
	let choices = [
		option_back,
		preversionChoice( 'New pre-patch version...', SEMVER_PRE_PATCH ),
		preversionChoice( 'New pre-minor version...', SEMVER_PRE_MINOR ),
		preversionChoice( 'New pre-major version...', SEMVER_PRE_MAJOR )
	];
	return console.prompt( {
		name: 'value',
		type: 'list',
		message: 'Start a new prerelease:',
		choices: choices,
		default: 1
	} ).then( answers => answers.value === option_back ? askReleaseType() : askPrereleaseIdentifier( answers.value ) );
}

function askPrereleaseIdentifier( prereleaseType ) {
	let identifierChoice = ( d, i ) => choice( semverFormat( d, prereleaseType, i ), i );
	let option_back = '< Back';
	let choices = [
		option_back,
		identifierChoice( 'Alpha', 'alpha' ),
		identifierChoice( 'Beta', 'beta' ),
		identifierChoice( 'Release Candidate', 'rc' )
	];
	return console.prompt( {
		name: 'value',
		type: 'list',
		message: 'Choose prerelease type:',
		choices: choices,
		default: 1
	} )
		.then( answers => answers.value === option_back ? askPrereleaseType() : versionate( prereleaseType, answers.value ) );
}

async function showGitLog( from, to ) {

	return Bluebird.resolve( [ from, to ] )
		.spread( git.log )
		.map( log => `${ chalk[ log.fixup ? 'red' : 'yellow' ]( log.id ) } ${ chalk[ log.fixup ? 'red' : 'white' ]( log.message ) }` )
		.tap( logs => {
			console.splitLongLines = false;
			console.indent( '>' );
			console.println();
			logs.forEach( m => console.println( m ) );
			console.println();
			console.outdent();
			console.splitLongLines = true;
		} );

}

async function npmTest() {

	console.line();
	console.info( 'Testing NPM package: ', 'npm test' );
	console.indent();
	console.splitLongLines = false;

	await npm.test( console.print, console.error )
		.then( () => console.outdent().info( 'All tests passed.\n\n' ), ex => { console.outdent(); throw new ProcedureError( 'Tests failed.', null, ex ); } );

	console.splitLongLines = true;
}

function getActionsRequiredToVersionate() {

	if ( !semver.valid( PACKAGE_VERSION ) )
		// Not a SemVer package
		return [ 'Package is in an invalid version according to SemVer.' ];

	if ( debugOpts.FAIL_ON_DIRTY_DIRECTORY && !EVERYTHING_COMMITTED ) {
		// There are some files yet to be commited
		addTask( { id: 'commit-everything', message: 'Commit all pending edits', command: `git commit -a`, restart: 1, interactive: 1, warning: 1 } );
		return [ 'Repository not clean, please commit all your files before creating a new version:', 'git commit -a' ];
	} else {
		removeTask( 'commit-everything' );
	}

	if ( debugOpts.FAIL_ON_INVALID_BRANCH && BRANCH !== 'develop' )
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

	console.line( true );

	let testsPassed;
	await npmTest().then( () => testsPassed = true, () => testsPassed = false );
	if ( !testsPassed ) {
		console.error( 'Tests are failing, cannot create a new version.\n' );
		return false;
	}

	//
	// ----------------------------------------------------
	// Input section
	// ----------------------------------------------------
	// We ask the user some questions
	//   about how it wants to proceed with the versioning.
	// We also ask if he wants this application
	//   to automatically update some of the project files.
	//

	console.line();

	NEXT_VERSION = semver.inc( VERSION, versionType, versionIdentifier );

	IS_UNSTABLE = _.includes( [ SEMVER_PRE_PATCH, SEMVER_PRE_MINOR, SEMVER_PRE_MAJOR, SEMVER_PRE_RELEASE ], versionType );

	let CHANGELOG = await askForChangelog( versionType, NEXT_VERSION );

	if ( CHANGELOG ) {
		fs.writeFileSync( 'CHANGELOG.md.draft', CHANGELOG, 'UTF-8' );
		CHANGELOG = _.chain( CHANGELOG )
			.replace( /\r\n/g, '\n' )
			.split( '\n' )
			.map( _.trim )
			.filter( Boolean )
			.join( '\n' )
			.trim()
			.value();
	}

	//
	// ----------------------------------------------------
	// Confirm section
	// ----------------------------------------------------
	// We ask the user for confirmation.
	// This is the last step before we proceed to modify
	//   the repository.
	//

	console.line();

	let PROCEED = await askForConfirmation( NEXT_VERSION );
	if ( !PROCEED ) {
		console.error( '\nOperation aborted by the user.\n' );
		return false;
	}

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


	console.line( true );

	RELEASE_BRANCH = `releases/${ NEXT_VERSION }`;
	RELEASE_TAG = `v${ NEXT_VERSION }`;

	if ( CHANGELOG ) {
		writeChangelogEntry( CHANGELOG );

		console.info( 'Changelog updated.' );
		console.line();
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

	let hasPackageLock = false;
	try {
		if ( fs.statSync( 'package-lock.json' ).isFile() ) {
			hasPackageLock = true;
		}
	} catch ( e ) {
		if ( e.code !== 'ENOENT' ) {
			throw e;
		}
	}
	if ( hasPackageLock )
		await announceAndExecuteAsync( `git add package-lock.json` );

	await announceAndExecuteAsync( `git commit -m "${ NEXT_VERSION }"` );
	await announceAndExecuteAsync( `git tag ${ RELEASE_TAG }` );

	if ( !IS_UNSTABLE ) {
		await announceAndExecuteAsync( `git checkout master` );
		await announceAndExecuteAsync( `git merge --no-ff ${ RELEASE_BRANCH }` );

		await announceAndExecuteAsync( `git checkout develop` );
		await announceAndExecuteAsync( `git merge --ff-only ${ RELEASE_BRANCH }` );

		await announceAndExecuteAsync( `git branch -d ${ RELEASE_BRANCH }` );
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

	completeReleaseProcess();

	return true;

}

function addTask( task ) {
	if ( task.id )
		removeTask( task.id );
	TASKS.push( task );
}

function removeTask( id ) {
	_.remove( TASKS, t => t.id === id );
}

module.exports = start;
