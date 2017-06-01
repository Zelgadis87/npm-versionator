
/* eslint-env mocha */

const chai = require( 'chai' )
	, stream = require( 'stream' )
	, chalk = require( 'chalk' )
	, Bluebird = require( 'bluebird' )
	, expect = chai.expect
	;

describe( 'console', function() {

	let TestStream = function() {

		let me = this;

		me.output = '';
		me.stream = new stream.Writable( {
			write: function( chunk, encoding, next ) {
				me.output += chunk.toString();
				next();
			}
		} );

		return me;

	};

	let console, testStream;
	beforeEach( function() {
		testStream = new TestStream();
		console = require( './console.js' ).create( 10, testStream.stream );
	} );

	describe( 'Constructor', function() {

		it( 'Should return the same object every time', function() {
			expect( require( './console.js' ) ).to.be.equal( require( './console.js' ) );
		} );

		it( 'Should allow the default console to be overridden', function() {
			expect( require( './console.js' ).create() ).to.not.be.equal( require( './console.js' ) );
		} );

		it( 'Should use the given stream to output', function() {
			let counter = 0;
			let testStream = new stream.Writable( { write: () => counter++ } );
			require( './console.js' ).create( Number.MAX_SAFE_INTEGER, testStream ).print( '123' );
			expect( counter ).to.be.equal( 1 );
		} );

	} );

	describe( 'Printing', function() {

		it( 'Invoking console.print with a null parameter should throw an error', function() {
			expect( () => console.print() ).to.throw();
			expect( () => console.println() ).to.not.throw();
		} );

		it( 'Invoking console.print with an empty message should print nothing', function() {
			console.print( '' );
			expect( testStream.output ).to.be.equal( '' );
		} );

		it( 'Invoking console.print should print to the stream', function() {
			console.print( 'ok' );
			expect( testStream.output ).to.be.equal( '  ok' );
			console.print( 'ok' );
			expect( testStream.output ).to.be.equal( '  okok' );
		} );

		it( 'Invoking console.println multiple times should print to the stream on multiple lines', function() {
			console.println( 'ok' );
			console.println( 'ok' );
			expect( testStream.output ).to.be.equal( '  ok\n  ok' );
		} );

		it( 'Invoking console.outdent when already outdented should have no effect', function() {
			console.println( 'ok' );
			console.outdent();
			console.println( 'ok' );
			expect( testStream.output ).to.be.equal( '  ok\n  ok' );
		} );

		it( 'Should support infinitely nested indentations', function() {
			console.println( 'a' );
			console.indent();
			console.println( 'a.1' );
			console.indent();
			console.print( 'a.1' );
			console.println( '.1' );
			console.outdent();
			console.println( 'a.2' );
			expect( testStream.output ).to.be.equal( '  a\n    a.1\n      a.1.1\n    a.2' );
		} );

		it( 'Should support indentation symbols', function() {
			console.println( 'a' );
			console.indent( '!' );
			console.println( 'a.1' );
			console.indent( '>' );
			console.println( 'a.1.1' );
			console.println( 'a.1.2' );
			console.outdent();
			console.println( 'a.2' );
			expect( testStream.output ).to.be.equal( '  a\n  ! a.1\n  ! > a.1.1\n  ! > a.1.2\n  ! a.2' );
		} );

		it( 'Should not allow indentation symbols that ruin the layout', function() {
			expect( () => console.indent( ) ).to.not.throw();
			expect( () => console.indent( '' ), '"" is a valid indentation character' ).to.not.throw();
			expect( () => console.indent( '!!' ), '"!!" is not a valid indentation character' ).to.throw();
			expect( () => console.indent( 'abc' ), '"abc" is not a valid indentation chracter' ).to.throw();
			expect( () => console.indent( '\t' ), '"\t" is not a valid indentation chracter' ).to.throw();
		} );

		it( 'Should indent messages on multiple rows', function() {
			console.print( 'a\nb' );
			expect( testStream.output ).to.be.equal( '  a\n  b' );
		} );

		it( 'Should automatically split long lines without breaking words, when possibile', function() {
			console.print( 'ab ab ab ab ab ab ab ab ab ab' );
			expect( testStream.output ).to.be.equal( '  ab ab ab\n    ab ab ab\n    ab ab ab\n    ab' );
		} );

		it( 'Should automatically split long lines by breaking words, if no spaces are available', function() {
			console.print( 'abcdefghilmnopqrstuvz' );
			expect( testStream.output ).to.be.equal( '  abcdefghil\n    mnopqrst\n    uvz' );
		} );

		it( 'Should allow changing line length at runtime', function() {
			console.lineLength = 9999;
			console.print( 'abcdefghilmnopqrstuvz' );
			expect( testStream.output ).to.be.equal( '  abcdefghilmnopqrstuvz' );
		} );

		it( 'Should stylize text', function() {
			console.print( 'ab', chalk.yellow );
			expect( testStream.output ).to.be.equal( '  ' + chalk.yellow( 'ab' ) );
		} );

	} );

	describe( 'Blank lines', function() {

		it( 'Should print a new line when requested', function() {
			console.print( 'a' );
			console.print( 'b' );
			console.line();
			console.print( 'c' );
			console.print( 'd' );
			console.line();
			console.print( 'e' );
			expect( testStream.output ).to.be.equal( '  ab\n  cd\n  e' );
		} );

		it( 'Should not print more than two consecutive blank lines', function() {
			console.print( 'a' );
			console.line();
			console.line();
			console.line();
			console.line();
			console.line();
			console.println( 'b' );
			console.line();
			console.line();
			console.print( 'c\n' );
			console.line();
			console.line();
			console.print( 'd\n\n\n\n\n\ne\n\nf' );
			expect( testStream.output ).to.be.equal( '  a\n\n  b\n\n  c\n\n  d\n\n  e\n\n  f' );
		} );

		it( 'Should print two consecutive blank lines when forced to do so', function() {
			console.print( 'a' );
			console.line();
			console.line();
			console.line( true );
			console.println( 'b' );
			console.line();
			console.line( true );
			console.print( 'c\n' );
			console.line();
			console.line( true );
			console.print( 'd' );
			expect( testStream.output ).to.be.equal( '  a\n\n\n  b\n\n\n  c\n\n\n  d' );
		} );

	} );

	describe( 'Prompting', function() {

		it( 'Should introduce a new line before prompting', function() {
			console.println( 'a' );
			let promise = Bluebird
				.resolve( console.prompt( { name: 'test', message: 'test 1', type: 'input' } ) )
				.tap( () => {
					expect( testStream.output ).to.be.equal( '  a\n' );
				} ).tap( () => {
					console.prompt( { name: 'test', message: 'test 2', type: 'input' } );
				} ).tap( () => {
					expect( testStream.output ).to.be.equal( '  a\n' );
				} );
			process.stdin.push( 'x\n' );
			process.stdin.push( 'x\n' );
			return promise;
		} );

		it( 'Should read input from the standard input', function() {
			let promise = console.prompt( { name: 'test', message: 'test', type: 'input' } ).then( answers => {
				expect( answers.test ).to.be.equal( 'x' );
			} );
			process.stdin.push( 'x\n' );
			return promise;
		} );


	} );

} );