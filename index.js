#!/usr/bin/env node

const Bluebird = require( 'bluebird' )
	, process = require( 'process' )
	, yargs = require( 'yargs' ).argv

	, logger = require( './lib/logger.js' )
	, ProcedureError = require( './lib/utils.js' ).ProcedureError
	, main = require( './lib/main.js' )
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
