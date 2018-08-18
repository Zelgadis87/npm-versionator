
class ProcedureError extends Error {

	constructor( message, command, error ) {
		super( message );
		this.command = command;
		this.stacktrace = error ? error.stack : null;
	}

}

class ExecutionFailedError extends Error {

	constructor( error_code, command, commandArgs = [] ) {
		super( 'Execution failed with error ' + error_code );
		this.command = command + commandArgs.join( ' ' );
	}

}

function countLines( contents ) {
	let count = -1;
	if ( contents.length > 0 )
		for ( let index = 0; index != -1; count++, index = contents.indexOf( '\n', index + 1 ) );
	return count + 1;
}

module.exports = {
	ProcedureError: ProcedureError,
	ExecutionFailedError: ExecutionFailedError,
	countLines: countLines
};