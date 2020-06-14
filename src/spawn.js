
const Bluebird = require( 'bluebird' )
	, child_process = require( 'child_process' )
	;

async function spawn( value ) {

	let cmd, args;
	if ( process.platform === 'win32' ) {
		// See spawn_v1 for details.
		cmd = 'cmd';
		args = [ '/c', value ];
	} else {
		args = value.split( /\s+/ );
		cmd = args.shift();
	}

	return new Bluebird( ( resolve, reject ) => {
		let spawned = child_process.spawn( cmd, args, { stdio: [ process.stdin, process.stdout, process.stderr ] } );
		spawned.on( 'close', code => {
			if ( code === 0 )
				return resolve();
			return reject( new Error( 'Child process did not exit succesfully: ' + code ) );
		} );
	} ).delay( 150 );
}

module.exports = spawn;
