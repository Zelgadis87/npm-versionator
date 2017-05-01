
# What is it?
This library is an opinionated tool for helping users manage their versioning of an NPM packing withing a Git repository.

# How does it work?
This package exposes a simple Command Line Interface (CLI) for managing the version of a NPM package.
The interface will guide the user on what it should do to create a new version of his package.
Common erronoeus situations are automatically detected, and instructions on how to solve them are given to the user, if appropriate.
The tool will also enforce some good behaviors, like preventing to make a release from a repository that contains uncommited work, or enforcing that all NPM configured tests are successful.

# Compabilities
This package is supposed to work both for new NPM packages and for existing ones.
However, as the tool is opinionated, a few policies are enforced on your package:
- The package MUST follow the [Semantic Verioning](http://semver.org)  conventions.
- The Git repository MUST follow the [GitFlow](http://nvie.com/posts/a-successful-git-branching-model/) convention and in particular:
  - Development of the package MUST be made on the Git *develop* branch or merged to it.
  - The *master* branch is reserved for public versions and work MUST NOT be commited to it.
  - The software developer CAN choose to use feature branches and other Git techniques, but in a way that MUST NOT conflict with the above two specifications.
- Tests to perform before a release SHOULD be specified using the `test` NPM task, as that is what gets launched to ensure a valid release.

# What does it do?
At the most fundamental level, this tool will tag a new version on the Git repository and on the NPM package.json file whenever the user decides to (pre)release a new version of its software.

When creating a release, all development made to *develop* is merged on a new release branch, named after the new version number. On this branch, the CHANGELOG.md file is updated with the new features and fixes that are getting released and the NPM package is increased. The work is finally merged to *master*, where it is tagged, and back on *develop*.

When creating a pre-release version, the work gets tagged directly on the *develop* branch and instructions are given to the developer on how to publish its unstable package, without breaking existing dependants libraries.

# How to use it?
1. Install this package as dev-dependency of your package, using:
```npm install --save-dev @zelgadis87/npm-versionator```
1. Create a script on your `package.json` using `npm-versionator`. Do **not** use `version` as the task name, as that would conflict with the standard NPM usage. You can use `version` (and the `preversion` and `postversion` hooks) to execute additional commands when creating a version, the same as a standard NPM package, and this tool will honor them. Example:
```
...
"scripts": {
  "versionator": "npm-versionator"
}
...
```

3. When ready for a (pre)release, use `npm run versionator` and follow the CLI instructions.

You can also install this tool as a global dependency, using `npm install -g @zelgadis87/npm-versionator`, and use it as `npm-versionator`, but that is not recommended.