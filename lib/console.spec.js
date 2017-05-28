
/* eslint-env mocha */

const chai = require( 'chai' )
	, _ = require( 'lodash' )
	, stream = require( 'stream' )
	, chalk = require( 'chalk' )
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

	describe( 'Constructor', function() {

		let console = require( '../lib/console.js' );

		it( 'Should return the same object every time', function() {
			expect( console ).to.be.equal( require( '../lib/console.js' ) );
		} );

		it( 'Should allow the default console to be overridden', function() {
			expect( console.create() ).to.not.be.equal( require( '../lib/console.js' ) );
		} );

		it( 'Should use the given stream to output', function() {
			let counter = 0;
			let testStream = new stream.Writable( { write: () => counter++ } );
			console.create( Number.MAX_SAFE_INTEGER, testStream ).print( '123' );
			expect( counter ).to.be.equal( 1 );
		} );

	} );

	describe( 'Printing', function() {

		let console, testStream;

		beforeEach( function() { 
			testStream = new TestStream();
			console = require( '../lib/console.js' ).create( 10, testStream.stream );
		} );

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

		it( 'Should indent messages on multiple rows', function() {
			console.print( 'a\nb' );
			expect( testStream.output ).to.be.equal( '  a\n  b' );
		} );

		it( 'Should automatically split long lines without breaking words, when possibile', function() {
			console.print( 'ab ab ab ab ab ab ab ab ab ab' );
			expect( testStream.output ).to.be.equal( '  ab ab ab\n  ab ab ab\n  ab ab ab\n  ab' );
		} );

		it( 'Should automatically split long lines by breaking words, if no spaces are available', function() {
			console.print( 'abcdefghilmnopqrstuvz' );
			expect( testStream.output ).to.be.equal( '  abcdefghil\n  mnopqrstuv\n  z' );
		} );

		it( 'Should stylize text', function() {
			console.print( 'ab', chalk.yellow );
			expect( testStream.output ).to.be.equal( '  ' + chalk.yellow( 'ab' ) );
		} );

	} );



} );