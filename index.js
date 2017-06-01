#!/usr/bin/env node

const Bluebird = require( 'bluebird' )
	, process = require( 'process' )
	, yargs = require( 'yargs' ).argv

	, console = require( './src/my-console.js' )
	, ProcedureError = require( './src/utils.js' ).ProcedureError
	, main = require( './src/main.js' )
	;

function activate() {
	return Bluebird.resolve( main() );
}

Bluebird
	.try( activate )
	.then( () => process.exit( 0 ) )
	.catch( ( err ) => {
		console.lineLength = 9999;
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
		console.error( 'Execution aborted.' );
		process.exit( 1 );
	} )
	;
