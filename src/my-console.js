
const Console = require( './console.js' )
	, chalk = require( 'chalk' )
	, _ = require( 'lodash' )
	;

let console = Console.create( 60 );
let iff = ( c, t, f ) => c ? t() : f();
let info = ( m ) => console.print( m, chalk.green );
let warn = ( m ) => console.print( m, chalk.yellow );
let command = ( m ) => console.print( m, chalk.cyan );

console.info = ( m, c ) => info( m, chalk.green ) & iff( c, () => command( ' ' + c ), _.noop ) & console.line();
console.warn = ( m, c ) => warn( m, chalk.yellow ) & iff( c, () => command( ' ' + c ), _.noop ) & console.line();
console.error = ( m, c ) => warn( m, chalk.red ) & iff( c, () => command( ' ' + c ), _.noop ) & console.line();
console.command = ( c ) => command( c ) & console.line();
console.title = ( m ) => { let hr = _.repeat( '-', m.length ); info( hr + '\n' + m + '\n' + hr + '\n' ); };

module.exports = console;
