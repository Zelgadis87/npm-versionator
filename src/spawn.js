
const Bluebird = require( 'bluebird' )
	, child_process = require( 'child_process' )
	;

async function spawn( value ) {
	let args = value.split( /\s+/ );
	let cmd = args.shift();
	return new Bluebird( ( resolve, reject ) => {
		let spawned = child_process.spawn( cmd, args, { stdio: 'inherit' } );
		spawned.on( 'error', reject );
		spawned.on( 'close', resolve );
	} ).delay( 150 );
}

module.exports = spawn;