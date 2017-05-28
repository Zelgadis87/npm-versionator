
const Bluebird = require( 'bluebird' )
	, execute = require( './execute.js' )
	, utils = require( './utils.js' )
	;

let git = {};

git.validate = async function() {
	let handleError = ( message, command = null ) => {
		return ( err ) => {
			throw err.code === 128 ? new utils.ProcedureError( message, command ) : err;
		};
	};
	await execute( 'git status' ).catch( handleError( 'Not a valid Git repository. To create a new repository, use:', 'git init' ) );
	await execute( 'git rev-parse HEAD' ).catch( handleError( 'Git repository seems to be empty, please commit some changes first.' ) );
	await execute( 'git rev-parse master' ).catch( handleError( 'Missing branch master, please create it on the first commit of the repository:', 'git branch master <first_commit_id>' ) );
	await execute( 'git rev-parse develop' ).catch( handleError( 'Missing branch develop, please branch it off master and use that for development:', 'git checkout -b develop master' ) );
};

git.getLatestVersionTag = async function() {
	let latestVersionTag = null;
	let sha = await execute( 'git rev-list --tags=v*.*.* --max-count=1' ).catch( ( err ) => {
		if ( err.code === 129 ) {
			// No tags found, return empty version.
			return null;
		}
		throw err;
	} );
	if ( sha )
		latestVersionTag = await execute( `git describe --tags ${ sha } --match=v*.*.*` );
	return latestVersionTag;
};

git.getCurrentBranch = async function() {
	return execute( 'git rev-parse --abbrev-ref HEAD' )
		.then( ( name ) => {
			if ( name !== 'HEAD' )
				return name;
			return '*detached HEAD';
		} );
};

git.countUntrackedFiles = async function() {
	return execute( 'git ls-files --exclude-standard --others' ).then( utils.countLines );
};

git.countDiffCommits = async function( from ) {
	return execute( `git rev-list --count --right-only ${ from }...HEAD` ).then( parseInt );
};

git.countDiffFiles = async function( from ) {
	return execute( `git diff --name-only ${ from }...HEAD` ).then( utils.countLines );
};

git.isRepositoryClean = async function() {
	// return execute( 'git diff-index --quiet HEAD --', false ).then( () => true, () => false ); // Removed, as this would return the wrong value in some cases: http://stackoverflow.com/a/2659808/90006
	return Bluebird.all( [
		execute( 'git diff-index --quiet --cached HEAD' ).then( () => true, () => false ),
		execute( 'git diff-files --quiet' ).then( () => true, () => false )
	] ).spread( ( diffIndex, diffFiles ) => diffIndex && diffFiles );
};

git.getRemoteRepositories = async function() {
	return execute( 'git remote' ).then( output => output.length > 0 ? output.split( '\n' ) : [] );
};

module.exports = git;