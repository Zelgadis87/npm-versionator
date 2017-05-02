
# What is it?
This library is an opinionated tool for helping users manage the versioning process of an NPM package.

# How does it work?
This package exposes a simple Command Line Interface (CLI) for guiding the user during the process of creation a new version of an NPM package.
The interface will guide the user on what it should do to create a new version of their package.
Common erronoeus situations are automatically detected, and instructions on how to solve them are given to the user, when appropriate.
The tool will also enforce some good behaviors, like preventing to make a release from a repository that contains uncommited work, or enforcing that all NPM configured tests are successful before tagging the release.

# Compabilities
This package is able to work both for new NPM packages and for existing ones.
However, to ensure a correct usage, from the first use of this tool onwards:

- The package MUST follow the [Semantic Verioning](http://semver.org)  conventions.
- The Git repository MUST follow the [GitFlow](http://nvie.com/posts/a-successful-git-branching-model/) convention. In particular:
  - Development of the package MUST be made on the Git *develop* branch or merged to it.
  - The *master* branch is reserved for public versions and work MUST NOT be commited to it.
  - Feature branches and other Git techniques are allowed, but their usage MUST NOT conflict with the above two specifications.

# Best practices
This tool is opinionated and will try to follow some useful conventions. In particular:

- It will enforce that a new version can only be created from *develop* and with a clean repository.
- It will check that all configured NPM tests are passed.
- A request for an entry to the CHANGELOG.md file is asked when versioning a project.
- Once a version is created, by specification, it cannot (at least, not easily) be undone (although no push to remote repositories or publishing on NPM registries is done automatically). 
- Version numbers cannot be decreased, and it is not possible to go back to an alpha prerelease from a beta prerelease, or to a beta release from a release candidate.
- If the developer decides to use release candidates, no commit can be done between the latest RC and the final version, to ensure that no last minute bug is introduced in the system.
- A warning will be emitted for untracked files, and if LICENSE, README.md, CHANGELOG.md and/or the .gitignore file is missing from the project

# What does it do?
At the most fundamental level, this tool will tag a new version on the Git repository and on the NPM package.json file whenever the user decides to (pre)release a new version of its software.

When creating a release, all development made to *develop* is merged on a new release branch, named after the new version number. On this branch, the CHANGELOG.md file is updated with the new features and fixes that are getting released and the NPM package is increased. The work is finally merged to *master*, where it is tagged, and it is merged back on *develop*. Commands to push the changes and publish the package are emitted for the developer convenience. Nothing is ever pushed automatically by the tool.

When creating a pre-release version, the work gets tagged directly on the *develop* branch and instructions are given to the developer on how to publish its unstable package, without breaking existing dependants libraries.

In both cases, the tool will ensure that the new version passes the configured NPM tests before proceeding.

# How to use it?
1. Install this package as dev-dependency of your package, using:
```npm install --save-dev @zelgadis87/npm-versionator```
1. Create a script on your `package.json` named `versionate` that simply starts `npm-versionator`. You can name the task however you want, but **DO NOT** use `version` as the name, as that would conflict with the standard NPM package lifecycle. You can instead use `version` (+ the `preversion` and `postversion` hooks) to execute additional commands when creating a version, the same as a standard NPM package, and this tool will honor those commands.
1. When ready for a (pre)release, use `npm run versionate` and follow the CLI instructions.

Example of a minimal `package.json` using `npm-versionator`:
```
{
  "name": "test-npm-package",
  "version": "1.3.0",
  "scripts": {
    "test": "eslint -c .eslintrc *.js",
    "versionate": "npm-versionator"
  },
  "devDependencies": {
    "eslint": "^3.19.0",
    "@zelgadis87/npm-versionator": "^0.4.2"
  }
}
```

You can also install this tool as a global dependency, using `npm install -g @zelgadis87/npm-versionator`. In this way you can use the tool from any project, by simply typing `npm-versionator` on your command line.