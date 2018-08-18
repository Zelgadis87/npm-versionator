#!/usr/bin/env node

const Bluebird = require( 'bluebird' )
	, process = require( 'process' )
	, yargs = setupYargs( require( 'yargs' ) ).argv

	, console = require( './src/my-console.js' )
	, ProcedureError = require( './src/utils.js' ).ProcedureError
	, main = require( './src/main.js' )
	;

function setupYargs( yargs ) {
	return yargs
		.option( 'verbose', { boolean: true, default: false, describe: 'Shows additional informations' } )
		.option( 'failOnVersionMismatch', { boolean: true, default: true, describe: 'Aborts if there is a mismatch between Git and Npm versions' } )
		.option( 'failOnDirtyDirectory', { boolean: true, default: true, describe: 'Aborts if there are uncommitted changes in Git' } )
		.option( 'failOnInvalidBranch', { boolean: true, default: true, describe: 'Aborts if the current branch is not develop' } )
		;
}

function activate() {
	return Bluebird.resolve( main( yargs ) );
}

Bluebird
	.try( activate )
	.then( () => process.exit( 0 ) )
	.catch( ( err ) => {
		console.splitLongLines = false;
		console.line( true );
		if ( err instanceof ProcedureError ) {
			console.error( err.message, err.command );
			if ( yargs.verbose && err.stacktrace ) {
				console.indent();
				console.error( err.stacktrace );
				console.outdent();
			}
		} else {
			console.error( 'An unexpected error has occured:' );
			if ( yargs.verbose && err.stack ) {
				console.error( err.stack );
			} else {
				console.error( err.message );
			}
		}
		console.error( 'Execution aborted.\n\n' );
		process.exit( 1 );
	} )
	;
