
class ProcedureError extends Error {

	constructor( message, command ) {
		super( message );
		this.command = command;
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
	countLines: countLines
};