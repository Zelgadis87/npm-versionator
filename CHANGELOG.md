
## v1.0.1 (2018/03/11 16:58)
- Updated dependencies

## v1.0.0 (2017/11/12 03:47)
- Breaking: Release tag is now made on the release branch instead of master
- Added: Allow the user to see the commits log before starting a release
- Added: Allow the user to test its package before starting a release
- Added: Detect and warn the user in case any fixup commits is found in the log
- Added: Allow the user to handle post-version tasks directly inside the tool, like pushing and publishing
- Added: Show commit logs before asking for a changelog entry
- Added: Allow the user to commit all pending changes, if the repository is not clean
- Added: Allow the user to rebase its commits, if the repository still contains fixup commits
- Improved: Test output is now colored accordingly to the shell capabilities

## v0.6.2 (2017/11/11 14:09)
- Fix: Changelog entry correctly considers user OS EOL character when asking for an entry
- Fix: Changelog entry is correctly saved on disk using LF as the EOL character

## v0.6.1 (2017/11/07 21:38)
- Fix: Added delay in command execution to try to prevent a possible issue with Git file handling

## v0.6.0 (2017/11/07 21:20)
- Created infrastructure for a more interactive user experience
- Fixed package-lock.json handling

## v0.5.0 (2017/05/12 21:04)
- Massive code refactoring

## v0.4.0-alpha.3 (2017/05/01 21:01)
- Feature: Added LICENSE file to the project

## v0.4.0-alpha.2 (2017/05/01 20:59)
- Feature: Warn the user in case of missing README.md, LICENSE or .gitignore files 
- Feature: Added README.md file to the project

## v0.4.0-alpha.1 (2017/05/01 19:08)
- Feature: Allow prereleases without any commits

## v0.4.0-alpha.0 (2017/05/01 14:59)
- Feature: Implemented prerelease versioning, supports: alpha, beta, RC
- Change: Changelog.md releases are now timestamped

## v0.3.0 (2017/04/30)
- Feature: Enforced NPM tests before proceeding with a new version.

## v0.2.1 (2017/04/30)
- Fix: Computed count of untracked and changed git files is 1 less than the actual value

## v0.2.0 (2017/04/29)
- Feature: New warning for missing Git remotes
- Feature: Explanation on how to push changes changed to use the project Git remotes

## v0.1.0 (2017/04/29)
- Initial version.
