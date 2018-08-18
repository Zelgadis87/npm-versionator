
ERRORS:
	- [L] Pressing Ctrl-C at the main menu results in exit code 1
		- This means that NPM will think the process exited incorrectly and dump all error infos to the user
		- Investigating the code, it seems inquirer\lib\ui\baseUI.js intercepts Ctrl-Cs, cleans up and SIGINT the process. This seems to be unavoidable.

FLOW:
	- [H] Prevent possible errors during the release flow:
		- ?
	- [H] Start changelog from the draft, if found
	- [M] Before asking for a changelog entry, be sure that we really want to versionate. However, after the changelog, another confirmation is required...
	- [L] Rollback on error

UTILITY:
	- [H] In case of pending edits, print a list of files with changes.
	- [VL] Allow the user to commit all changes directly from the main menu