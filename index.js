#!/usr/bin/env node

const Bluebird = require( 'bluebird' )
	, process = require( 'process' )
	, yargs = require( 'yargs' ).argv

	, logger = require( './src/logger.js' )
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
		logger.line( true );
		if ( err instanceof ProcedureError ) {
			logger.error( err.message, err.command );
			if ( yargs.verbose && err.stacktrace ) {
				logger.error( err.stacktrace );
			}
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
