[![Build Status](https://semaphoreci.com/api/v1/joehenry087/structure/branches/master/badge.svg)](https://semaphoreci.com/joehenry087/structure)

Structure is a template for building and deploying node.js projects. It includes:

* Gulp based development already setup to watch *everything* (static files, media, js, less, server files) and rebuild upon changes. 
* Each component is watched separately so only what you change gets rebuilt. It's super fast.
* LiveReload so you don't have to refresh your website to see changes.
* Docker. Only your prod dependencies get installed. Gulp also watches your server files and reboots the docker container after changes, in effect restarting your server. It's also super quick because there's no rebuilding.
* Beautiful, simple project structure that is easy to understand and already setup to work with Semaphore, AWS Elastic Container Registry and Elastic Beanstalk for a seamless deployment pipeline. See instructions further below for setting up Semaphore and AWS.

# Using Structure

## Installation

1. Clone the repo, cd into the base directory, run `npm install --only=dev`

2. Create a `config.json` file that looks like this in the root directory:

```
{
    "app": {
        "environment": "dev"
    }
}
```

*You may change the location of the "environment" variable, but remember to update `gulpfile.js` as well. See more about `config.json` under [Documentation > Files](#files)*

3. If you wish, you can install the [LiveReload](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei) plugin to have your browser automatically update after file changes during development.

4. You should now be able to run a development setup as described next. You may need to run `docker-compose up --build` once before `gulp` works.

## Development

To start development run `gulp`. This will perform all of the following build steps once and then watch their respective source directories and rebuild upon detecting changes.

1. ROOT FILES: Copy the `source/root` folder which is where you put any static frontend files (not media or fonts) like `index.html`, `robots.txt`, `sitemap.xml`, etc.
2. CSS: Build Less files to CSS from the `source/less` directory.
3. JAVASCRIPT: Compile javascript files from the `source/js` directory.
4. FONTS & IMAGES: Copy fonts from the `source/fonts` directory and images from the `source/images` directory.
5. BACKEND: Copy files from the `source/server` directory and run `docker-compose up` which will launch a dev server.
6. BUILD FILES: Copy app files ('config.json', 'package.json', 'Dockerfile').

And now you're ready to develop.

*See [Documentation](#documentation) for more information on how the above are all compiled and how to add new JS files to the build process*

## Deployment

1. Make a Semaphore project. Use their docker platform.
2. Add your AWS account ID as environment variable `AWS_ACCOUNT_ID`. You probably want to encrypt this.
3. Add your `config.json` file under "Configuration Files" but make any relevant changes like "environment" which should be set to "prod".
4. Connect AWS ECR as your Docker Registry. Semaphore has good documentation on how to do this.
5. Under "Build Settings" use these five lines for the deployment script:

```
npm install --dev
PATH=$(npm bin):$PATH
gulp build
docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$SEMAPHORE_PROJECT_NAME:$REVISION .
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$SEMAPHORE_PROJECT_NAME:$REVISION
```

We are installing dev dependancies. Then adding local node_modules to the PATH so we can call gulp. Then we tell gulp to build the `_package` directory. Then we build the docker image which includes the `_package` directory. Then we push that to AWS.

6. For the Server setup you'll need to edit the deploy script to this:

```
sed -i -e 's/_version_/'$REVISION'/g' Dockerrun.aws.json
sed -i -e 's/_account-id_/'$AWS_ACCOUNT_ID'/g' Dockerrun.aws.json
echo "Zipping your Dockerrun file"; zip "$EB_APP_NAME".zip Dockerrun.aws.json
export EB_VERSION=`git rev-parse --short HEAD`-`date +%s`
aws s3 cp "$EB_APP_NAME".zip s3://$S3_BUCKET_NAME/"$EB_APP_NAME"/"$EB_VERSION".zip
aws elasticbeanstalk create-application-version --application-name "$EB_APP_NAME" --version-label "$EB_VERSION" --source-bundle S3Bucket=$S3_BUCKET_NAME,S3Key="$EB_APP_NAME/$EB_VERSION.zip" --description "`git show -s --format=%s HEAD | cut -c -200`"
aws elasticbeanstalk update-environment --environment-name "$EB_ENV_NAME" --version-label "$EB_VERSION"
echo "Environment status: `aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME" | grep '"Status"' | cut -d: -f2  | sed -e 's/^[^"]*"//' -e 's/".*$//'`"
echo "Your environment is currently updating"; while [[ `aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME" | grep '"Status"' | cut -d: -f2  | sed -e 's/^[^"]*"//' -e 's/".*$//'` = "Updating" ]]; do sleep 2; printf "."; done
if [[ `aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME" | grep VersionLabel | cut -d: -f2 | sed -e 's/^[^"]*"//' -e 's/".*$//'` = "$EB_VERSION" ]]; then echo "The version of application code on Elastic Beanstalk matches the version that Semaphore sent in this deployment."; echo "Your environment info:"; aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME"; else echo "The version of application code on Elastic Beanstalk does not match the version that Semaphore sent in this deployment. Please check your AWS Elastic Beanstalk Console for more information."; echo "Your environment info:"; aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME"; false; fi
sleep 5; a="0"; echo "Waiting for environment health to turn Green"; while [[ `aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME" | grep '"Health":' | cut -d: -f2  | sed -e 's/^[^"]*"//' -e 's/".*$//'` != "Green" && $a -le 30 ]]; do sleep 2; a=$[$a+1]; printf "."; done; if [[ `aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME" | grep '"Health":' | cut -d: -f2 | sed -e 's/^[^"]*"//' -e 's/".*$//'` = "Green" ]]; then echo "Your environment status is Green, congrats!"; else echo "Your environment status is not Green, sorry."; false; fi;
echo "Your environment info:"; aws elasticbeanstalk describe-environments --environment-names "$EB_ENV_NAME"
```

# Documentation

## Project Structure

It's very easy:

    - source - All your source files go here
        fonts
        images
        js - frontend js
        less - less, or turn this into sass if you prefer
        root - for static files like index.html, robots.txt
        server - for the express backend server
    - _package - Where everything gets built to. Ignored by git.
    - node_modules - Where your development node modules live. Ignored by git.
    - Other build related files

## Files

### .gitignore

We ignore the `node_modules` and `_package` directories as they are build time artifacts.

`config.json` is ignored because it can contain any sensitive information your backend needs to connect to databases, apis, etc. Semaphore allows you to upload a config file for each environment, perfectly replicating this local development setup.

### config.json

This is where you can store any environment specific information for your backend. Gulp also uses it to get the environment for building the project.

### Dockerfile
One Dockerfile for every environment. Its simple.

### docker-compose.yml
Used only for local development so we can do any port mapping we want, easily attach our `_package` directory with our build result as a volume to the docker machine and not pollute the `Dockerfile` with environment specific setup.

### Dockerrun.aws.json
The simplest possible file to get AWS Elastic Beanstalk to put up a new Docker image.

`_account-id_` and `_version_` are both replaced at build time on Semaphore.

### gulpfile.js
Used to build `source` to `_package` and for local development to watch files.

### package.json
Usual node app package file.

### sources.json
This is used by the gulpfile to get a list of frontend JS files to compile for builds. It is also watched by gulp, so when you create a new JS file for development as soon as you add it to sources.json, your JS will be rebuilt. You can also tell it to compile everything in a directory in which case you don't even have to add individual js files to this sources file.