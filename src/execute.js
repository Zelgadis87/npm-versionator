
const Bluebird = require( 'bluebird' )
	, child_process = require( 'child_process' )
	;

async function execute( cmd ) {
	return new Bluebird( ( resolve, reject ) => {
		child_process.exec( cmd, ( err, stdout, stderr ) => {
			if ( err ) reject( err );
			else resolve( stdout.trim() );
		} );
	} ).delay( 150 );
}

module.exports = execute;
