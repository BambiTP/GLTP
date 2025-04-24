# gltpdev
Tagpro GLTP dev environment

# Local Development
Edits should be mde in the src folder. 
Open two terminal tabs/windows:
Terminal 1:
`npm run build` - triggers a build of the src file which then sends output into the docs folder. This mimics what happens in github during the build process. 
Run `npm run build` and refresh the page to see changes to your local version. 
Terminal 2:
`npm run serve` - triggers a live server on localhost:8080/GLTP (opens on any browser) which watches the /docs folder for changes. Note that if 8080 is consumed by another process/tab it will assign a different port. You can verify the port/url in the console terminal

# Contributing Development Build Process
Make sure the github repo is setup to have pages serve from actions. The custom_build.yml file should trigger the build.js file. (note that on fresh forks if you run into issues, you might need to create a fresh copy of the custom_build.yml file to ensure that your github has the proper permissions)
