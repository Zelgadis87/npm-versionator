
const Console = require( './console.js' )
	, chalk = require( 'chalk' )
	, _ = require( 'lodash' )
	;

let console = Console.create( 60 );
let iff = ( c, t, f ) => c ? t() : f();
let info = ( m ) => console.print( m, chalk.green );
let warn = ( m ) => console.print( m, chalk.yellow );
let error = ( m ) => console.print( m, chalk.red );
let command = ( m ) => console.print( m, chalk.cyan );

console.info = ( m, c ) => info( m ) & iff( c, () => command( ' ' + c ), _.noop ) & console.line();
console.warn = ( m, c ) => warn( m ) & iff( c, () => command( ' ' + c ), _.noop ) & console.line();
console.error = ( m, c ) => error( m ) & iff( c, () => command( ' ' + c ), _.noop ) & console.line();
console.command = ( c ) => command( c ) & console.line();
console.title = ( m ) => { let hr = _.repeat( '-', m.length ); info( hr + '\n' + m + '\n' + hr + '\n' ); };

console.task = ( t ) => {
	console.splitLongLines = false;
	console.indent( t.done ? '✓' : '✗' );
	console.print( t.message, t.done ? chalk.green : chalk.yellow );
	if ( t.command ) {
		console.print( ' ' );
		command( ' ' + t.command );
	}
	console.line();
	console.outdent();
	console.splitLongLines = true;
};

module.exports = console;
