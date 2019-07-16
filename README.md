## TAP Validation Tab ==
* This is a Node/Express/Mongo app which runs in Teams. When installed in a team, you can select an active TAP validation and gather scenario works/fails feedback from the team's uesrs.
* The validations and scenarios are created with a separate app used by TAP PMs, the code for wihch is available in the (tap-validation-tab-admin)[https://github.com/v-masil/tap-validation-tab-admin] repo.

### Installation ===
* Download the Teams app zip from Releases here: [TAPValidationTab.zip][https://github.com/v-masil/tap-validation-tab/releases/tag/1.0.0]
* Side-load the app into your team, following the [instructions](https://docs.microsoft.com/en-us/microsoftteams/platform/concepts/apps/apps-upload) here.
* Add the app to the desired channel, and select the validation you want to collect feedback for.
* Users can now be directed to this tab to provide their feedback.

### Development ===
* To run this locally:
```npm install
$env:MONGO_STRING="(your Mongo connection string)""
$env:AUTH="Bearer (a Base64-encoded PAT with Azure DevOps workitem read/write access to the MSTeams project)"
nodemon server.js```

