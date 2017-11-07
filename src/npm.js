
const package = require( '../package' )
	, Bluebird = require( 'bluebird' )
	, child_process = require( 'child_process' )
	, fs = require( 'fs' )
	, ProcedureError = require( './utils.js' ).ProcedureError
	;

let npm = {};

npm.getVersion = async function() {
	return package.version;
};

npm.readPackageVersion = async function() {
	let packageJson = await fs.readFileAsync( 'package.json', 'UTF-8' );
	return JSON.parse( packageJson ).version;
};

npm.validate = async function() {
	if ( !fs.existsSync( 'package.json' ) )
		throw new ProcedureError( `Folder doesn't seem to contain a valid NPM package. To create a new package, use:`, 'npm init' );
};

npm.test = async function( data_out, data_err ) {

	return new Bluebird( ( resolve, reject ) => {
		let test = child_process.spawn( /^win/.test( process.platform ) ? 'npm.cmd' : 'npm', [ 'test', '--', '--color' ] );
		test.stdout.on( 'data', x => data_out( x.toString() ) );
		test.stderr.on( 'data', x => data_err( x.toString() ) );
		test.on( 'close', code => { return code === 0 ? resolve() : reject(); } );

	} );
};

module.exports = npm;