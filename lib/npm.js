
const package = require( '../package' )
	, Bluebird = require( 'bluebird' )
	, child_process = require( 'child_process' )
	, chalk = require( 'chalk' )
	, fs = require( 'fs' )
	, _ = require( 'lodash' )
	, logger = require( './logger.js' )
	, ProcedureError = require( './utils.js' ).ProcedureError
	;

let npm = function() {};

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

npm.test = async function() {

	let logTest = ( error, data ) => {
		if ( data === null || data === undefined )
			return;
		let lines = data.toString().split( '\n' ),
			style = chalk.bold,
			newline = false;
		for ( let line of lines ) {
			if ( newline ) {
				logger.line( true );
				logLine();
			}
			logger.out( style( line ) );
			newline = true;
		}
	};
	let logLine = () => logger.out( '    ' ); // TODO: Replace with logger.indent.

	return new Bluebird( ( resolve, reject ) => {

		logger.info( 'Testing NPM package: ', 'npm test -- --color'  );
		logLine();

		let test = child_process.spawn( /^win/.test( process.platform ) ? 'npm.cmd' : 'npm', [ 'test', '--', '--color' ] );
		test.stdout.on( 'data', _.partial( logTest, false ) );
		test.stderr.on( 'data', _.partial( logTest, true ) );
		test.on( 'close', ( code ) => {
			logger.line( true );
			code === 0 ? resolve() : reject();
		} );

	} );
};

module.exports = npm;