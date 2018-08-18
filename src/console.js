
const process = require( 'process' )
	, inquirer = require( 'inquirer' )
	, _ = require( 'lodash' )
	;

const LINE_LENGTH = 45;

function Console( lineLength = LINE_LENGTH, outputStream = process.stdout ) {

	var me = this;

	// Interface.
	me.print = print;
	me.println = println;
	me.line = line;
	me.indent = indent;
	me.outdent = outdent;
	me.prompt = prompt;
	me.lineLength = lineLength;
	me.splitLongLines = true;

	// Implementation
	let lines = 0,
		consecutiveNewLines = 0,
		newLine = true,
		indentValue = [ '  ' ],
		promptModule = inquirer.createPromptModule();

	function line( forced ) {
		if ( !newLine ) {
			// The end of the line will be inserted on the next print.
			newLine = true;
			consecutiveNewLines++;
		} else if ( forced || consecutiveNewLines < 2 ) {
			// Insert a new blank line if forced or there isn't one yet.
			write( '\n' );
			consecutiveNewLines++;
		}
		return me;
	}

	function print( msg, styleFn = _.identity ) {
		out( msg, styleFn );
	}

	function println( msg, styleFn = _.identity ) {
		if ( msg )
			out( msg, styleFn );
		line();
	}

	function out( msg, styleFn ) {
		if ( !_.isString( msg ) && !msg.toString )
			throw new Error( 'msg is a required parameter' );

		msg = msg.toString();
		if ( msg.indexOf( '\n' ) > -1 ) {

			if ( msg.endsWith( '\n' ) ) {
				out( msg.substring( 0, msg.length - 1 ), styleFn );
				line();
			} else {
				_( msg ).split( '\n' ).each( l => {
					if ( l.trim().length > 0 ) {
						out( l, styleFn );
					}
					line();
				} );
			}
			return;

		} else if ( msg.length > me.lineLength && me.splitLongLines ) {

			let last = msg.substring( 0, me.lineLength + 1 ).lastIndexOf( ' ' ), endFirst, startSecond;
			if ( last > Math.min( me.lineLength / 10, 3 ) ) {
				endFirst = last;
				startSecond = last + 1;
			} else {
				endFirst = startSecond = me.lineLength;
			}
			out( msg.substring( 0, endFirst ), styleFn );
			line();
			out( '  ' + msg.substring( startSecond ), styleFn );
			return;

		} else if ( msg.trim().length > 0 ) {
			if ( newLine ) {
				if ( lines > 0 ) {
					write( '\n' );
				}
				write( indentStr() );
				newLine = false;
				lines++;
			}
			write( styleFn( msg ) );
			consecutiveNewLines = 0;

		}
	}

	function indent( symbol = '' ) {
		if ( symbol.length > 1 || symbol === '\t' )
			throw new Error( 'Symbol should be a single character' );
		indentValue.push( _.padEnd( symbol, 2 ) );
		return me;
	}

	function outdent( n = 1 ) {
		if ( indentValue.length > 1 ) {
			indentValue.pop();
			if ( n > 1 ) { return outdent( n - 1 ); }
		}
		return me;
	}

	function indentStr() {
		return indentValue.join( '' );
	}

	function write( message ) {
		outputStream.write( message );
	}

	function prompt( args ) {
		if ( newLine ) {
			write( '\n' );
			newLine = false;
		}
		return promptModule( args );
	}

	return me;

}

module.exports = new Console();
module.exports.create = function() {
	return new Console( ...arguments );
};