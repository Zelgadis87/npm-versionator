
const chalk = require( 'chalk' )
	, process = require( 'process' )
	, _ = require( 'lodash' );

const LINE_LENGTH = 45, _console = require( 'console' );

function Console( lineLength = LINE_LENGTH, outputStream = process.stdout ) {

	var me = this;

	// Interface.
	me.print = print;
	me.println = println;
	me.line = line;
	me.indent = indent;
	me.outdent = outdent;

	// Implementation
	let lines = 0,
		newLine = true,
		indentValue = [ '  ' ];

	function line( forced ) {
		if ( newLine ) {
			if ( forced ) {
				write( '\n' );
				lines++;
			}
			return;
		}
		newLine = true;
	}

	function print( msg, styleFn = _.identity ) {
		return out( msg, styleFn );
	}

	function println( msg, styleFn = _.identity ) {
		return out( msg + '\n', styleFn );
	}

	function out( msg, styleFn ) {
		if ( !_.isString( msg ) )
			throw new Error( 'msg is a required parameter' );
		if ( msg.indexOf( '\n' ) > -1 ) {
			_( msg ).split( '\n' ).each( line => {
				out( line, styleFn );
				newLine = true;
			} );
			return;
		} else if ( msg.length > lineLength ) {
			let last = msg.substring( 0, lineLength ).lastIndexOf( ' ' ), endFirst, startSecond;
			if ( last > -1 ) {
				endFirst = last;
				startSecond = last + 1;
			} else {
				endFirst = startSecond = lineLength;
			}
			out( msg.substring( 0, endFirst ) + '\n', styleFn );
			out( msg.substring( startSecond ), styleFn );
			return;
		} else if ( msg.length > 0 ) {

			if ( newLine ) {
				if ( lines > 0 ) {
					write( '\n' );
				}
				write( indentStr() );
				newLine = false;
				lines++;
			}
			write( styleFn( msg ) );

		}
	}

	function indent( symbol = '' ) {
		if ( symbol.length > 1 || symbol === '\t' )
			throw new Error( 'Symbol should be a single character' );
		indentValue.push( _.padEnd( symbol, 2 ) );
		return me;
	}

	function outdent() {
		if ( indentValue.length > 1 )
			indentValue.pop();
		return me;
	}

	function indentStr() {
		return indentValue.join( '' );
	}

	function write( message ) {
		outputStream.write( message );
	}

	return me;

}

module.exports = new Console();
module.exports.create = function() {
	return new Console( ...arguments );
};