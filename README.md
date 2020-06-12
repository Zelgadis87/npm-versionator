
# What is it?
An opinionated tool for helping developers manage the versioning process of an NPM package.

# How does it work?
This package exposes a simple Command Line Interface (CLI) for guiding the user during the process of creation a new version of an NPM package.
The interface will guide the user on what it should do to create a new version of their package.
Common erronoeus situations are automatically detected, and instructions on how to solve them are given to the user, when appropriate.
The tool will also enforce some good behaviors, like preventing to make a release from a repository that contains uncommited work, or enforcing that all NPM configured tests are successful before tagging the release.

# Compabilities
This package is able to work for new and existing NPM packages.  
However, to ensure a correct usage, from the first use of the tool onwards:

- The package MUST follow the [Semantic Verioning](http://semver.org)  conventions.
- The Git repository MUST follow the [GitFlow](http://nvie.com/posts/a-successful-git-branching-model/) convention. In particular:
  - Development of the package MUST be made on the Git *develop* branch or merged to it.
  - The *master* branch is reserved for public versions and work MUST NOT be commited to it.
  - Feature branches and other Git techniques are allowed and encouraged, but their usage MUST NOT conflict with the above two specifications.

# Best practices
This tool is opinionated and will try to follow some useful best practices.  
In particular:

- It will enforce the correct usage of the *develop* branch, preventing the developer from creating versions with uncommited changes or from non-standard branches.
- It will enforce that all configured NPM tests are passing before allowing a release.
- A request for an entry to the CHANGELOG.md file is asked on every version and is timestamped and formatted automatically.
- By specification, once a version is created it cannot be undone, version numbers cannot be decreased, and it is not possible to go back to an alpha prerelease from a beta prerelease. This ensures that dependants package are safe and creates an environment where package versions can be entrusted.
- If the developer decises to use alpha and beta channels, the tool will encourage their appropriate use. It will first create alpha releases, then beta releases, then release candidates, then releases. All steps are optional.
- If the developer decides to use release candidates, the tool will enforce that no commit has been made between the latest RC and the final version, to ensure that no last minute bug is introduced in the system.
- A warning will be emitted if untracked files are detected in the repository.
- A warning will be emitted in case the LICENSE, README.md, CHANGELOG.md and/or .gitignore files are missing from the project.

# What does it do?
At the most fundamental level, whenever the user decides to (pre)release a new version of its software, this tool will take the existing work on the *develop* branch and use it to tag a new version on the Git repository and on the NPM package.json file. The developer is guided thorough the processm by first ensuring that the new version is valid and then by giving instructions on how to proceed to release the newly created version.

When creating a release, all development made to *develop* is merged on a new release branch, named after the new version number. On this branch, the CHANGELOG.md file is updated with the new features and fixes that are getting released and the NPM package is increased. This branch is tagged with the new version tag. The work is finally merged to *master*. The developer can then choose to push its changes to all configured repositories and publish the package on npm. Nothing is ever published automatically by the tool.

When creating a pre-release version, the work gets tagged directly on the *develop* branch and the developer can then choose to publish its unstable package, without breaking existing dependants libraries.

# How to use it?
Three main ways to use it:
  1. Install npm-versionator as a dev-dependency of your project (suggested).
  1. Use npm-versionator without installing it with npx
  1. Install npm-versionator as a global dependency

## As dev-dependency
1. Install this package as dev-dependency of your package, using:
```npm install --save-dev @zelgadis87/npm-versionator```
1. Create a script on your `package.json` named `versionate` that simply starts `npm-versionator`. You can name the task however you want, but **DO NOT** use `version` as the name, as that would conflict with the standard NPM package lifecycle. You can instead use `version` (+ the `preversion` and `postversion` hooks) to execute additional commands when creating a version, the same as a standard NPM package, and this tool will honor those commands.
1. When ready for a (pre)release, use `npm run versionate` and follow the CLI instructions.

Example of a minimal `package.json` using `npm-versionator`:
```
{
  "name": "test-npm-package",
  "version": "0.3.0",
  "scripts": {
    "test": "eslint -c .eslintrc *.js",
    "versionate": "npm-versionator"
  },
  "devDependencies": {
    "eslint": "latest",
    "@zelgadis87/npm-versionator": "latest"
  }
}
```

This way you decide which version of npm-versionator to use for your own project and can customize and persist its options specifically for the current project.

## With npx
Instead of installing it, you can use [npx](https://github.com/zkat/npx), which comes autoinstalled in most recent versions of npm, to execute npm-versionator in the projects you need it. To run it, just type `npx @zelgadis87/npm-versionator`. Requires npx installed to work.

## As a global dependency
Install npm-versionator globally using `npm install -g @zelgadis87/npm-versionator`. In this way, you can use the tool from any project, by simply typing `npm-versionator` on your command line.
