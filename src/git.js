
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

git.log = async function( from, to = 'HEAD' ) {
	return Bluebird.resolve( `git log ${ from }..${ to } --oneline` )
		.then( execute )
		.then( text => text.split( '\n' ) )
		.then( lines => lines.reverse() )
		.filter( Boolean )
		.map( line => line.trim() )
		.map( line => {
			let matches = line.match( /^([a-z0-9]+)(.*)$/ );
			return {
				id: matches[ 1 ],
				message: matches[ 2 ]
			};
		} )
		.map( log => {
			log.fixup = !!log.message.trim().match( /^(fixup!|squash!)/ );
			return Bluebird.resolve( `git show --no-patch --format="%P" ${ log.id }` )
				.then( execute )
				.then( x => x.split( /\s+/ ) )
				.then( parents => {
					log.parents = parents;
					log.merge = log.parents.length > 1;
					return log;
				} );
		} );
};

module.exports = git;