
const chalk = require( 'chalk' )
	, process = require( 'process' )
	, _ = require( 'lodash' );

function Logger() {

	let me = this;

	// Interface
	me.info = info;
	me.error = error;
	me.warn = warn;
	me.line = line;
	me.command = command;
	me.title = title;
	me.out = out;

	// Implementation

	let isNewLine = false;

	function out( m ) {
		process.stdout.write( m );
	}

	function err( m ) {
		process.stderr.write( m );
	}

	function line( forced ) {
		if ( isNewLine && !forced )
			return;
		out( '\n' );
		isNewLine = true;
	}

	let prepend = ( a ) => ( b ) => a + b;
	let append = ( b ) => ( a ) => a + b;

	let prefix = ( x ) => prepend( x + ' ' );
	let newline = ( x ) => { isNewLine = false; return x + '\n'; };

	let combine = ( x, ...fns ) => ( x === null || x === undefined ) ? '' : _.flow( fns )( x );

	function info( m, c ) {
		out( combine( m, prefix( ' ' ), append( combine( c, prepend( ' ' ), chalk.cyan ) ), chalk.green, newline ) );
	}

	function warn( m, c ) {
		out( combine( m, prefix( ' ' ), append( combine( c, prepend( ' ' ), chalk.cyan ) ), chalk.yellow, newline ) );
	}

	function error( m, c ) {
		err( combine( m, prefix( ' ' ), append( combine( c, prepend( ' ' ), chalk.cyan ) ), chalk.red, chalk.bold, newline ) );
	}

	function command( m ) {
		out( combine( m, prefix( '>' ), chalk.cyan, newline ) );
	}

	function title( m ) {
		let hr = _.repeat( '-', m.length );
		info( hr );
		info( m );
		info( hr );
	}

	return me;

}

module.exports = new Logger();