 sap.ui.define([
     "sap/ui/core/mvc/Controller",
     "sap/ui/model/json/JSONModel",
     "sap/m/MessageToast",
     "jquery.sap.global"
 ], function(Controller, JSONModel, MessageToast, jQuery) {
     "use strict";
     return Controller.extend("jirapivot.controller.Home", {
         onInit: function() {
             this.jql = 'project in ("AOCL","INF","INT")';
             this.synchronizedJiraIssues = [];
             if (window.localStorage.synchronizedJiraIssues) {
                 this.synchronizedJiraIssues = JSON.parse(LZString.decompress(window.localStorage.synchronizedJiraIssues));
             }
             this.synchronizedJiraWorklog = {};
             if (window.localStorage.synchronizedJiraWorklog) {
                 this.synchronizedJiraIssues = JSON.parse(LZString.decompress(window.localStorage.synchronizedJiraWorklog));
             }
         },
         onJiraIssueLoad: function() {
             var me = this;
             var jiraConfiguration = window.localStorage.jiraConfiguration;
             if (!jiraConfiguration) {
                 this.onJiraConfigurationShow({}, function() {
                     me.onJiraIssueLoad();
                 });
             } else {
                 jiraConfiguration = JSON.parse(jiraConfiguration);
             }
             this.loadIssuesFromJira(jiraConfiguration, { "maxResults": 1000 }, true);

         },
         loadIssuesFromJira: function(jiraConfiguration, parameters, openDialog) {
             var me = this;
             var oHeaders = {
                 "Authorization": "Basic " + btoa(jiraConfiguration.username + ':' + jiraConfiguration.password)
             };

             var jiraUrl = jiraConfiguration.baseUrl + "/rest/api/2/search";
             if (!this._oJiraLoadDialog) {
                 this._oJiraLoadDialog = sap.ui.xmlfragment("jirapivot.view.JiraLoadDialog", this);
                 this.getView().addDependent(this._oJiraLoadDialog);
             }
             if (openDialog) {
                 this._oJiraLoadDialog.open();
             }
             if (this.jql) {
                 parameters["jql"] = this.jql;
             }

             jQuery.ajax({
                     "url": jiraUrl,
                     "data": parameters,
                     "type": "GET",
                     "headers": oHeaders
                 }).done(function(data) {
                     Array.prototype.push.apply(me.synchronizedJiraIssues, data.issues);

                     var progressIndicator = me._oJiraLoadDialog.getContent()[0];
                     progressIndicator.setPercentValue((data.startAt + data.maxResults) / data.total * 100);
                     progressIndicator.setDisplayValue((data.startAt + data.maxResults) + " of " + data.total);

                     if (parameters.total === 0 || parameters.total <= parameters.startAt + parameters.maxResults) {
                         MessageToast.show("All JIRA issues loaded.");
                         window.localStorage.synchronizedJiraIssues = LZString.compress(JSON.stringify(me.synchronizedJiraIssues));
                         me._oJiraLoadDialog.close();
                     } else {
                         var newParameters = {
                             "total": data.total,
                             "startAt": data.startAt + data.maxResults,
                             "maxResults": data.maxResults
                         };
                         me.loadIssuesFromJira(jiraConfiguration, newParameters);
                     }
                 })
                 .fail(function() {
                     MessageToast.show("Failed to add function point analysis");
                 });
         },
         onJiraWorklogLoad: function() {
             var me = this;
             var jiraConfiguration = window.localStorage.jiraConfiguration;
             if (!jiraConfiguration) {
                 this.onJiraConfigurationShow({}, function() {
                     me.onJiraWorklogLoad();
                 });
             } else {
                 jiraConfiguration = JSON.parse(jiraConfiguration);
             }
             this.loadWorklogs(jiraConfiguration);

         },
         loadWorklogs: function(jiraConfiguration) {
             var me = this;
             var oHeaders = {
                 "Authorization": "Basic " + btoa(jiraConfiguration.username + ':' + jiraConfiguration.password)
             };

             var jiraUrl = jiraConfiguration.baseUrl + "/rest/api/2/issue/";
             if (!this._oJiraLoadDialog) {
                 this._oJiraLoadDialog = sap.ui.xmlfragment("jirapivot.view.JiraLoadDialog", this);
                 this.getView().addDependent(this._oJiraLoadDialog);
             }

             this._oJiraLoadDialog.open();
             var retrievedWorklogs = 0;
             var total = this.synchronizedJiraIssues.length;

             var ajaxPromises = [];

             for (var i = 0; i < this.synchronizedJiraIssues.length; i++) {
                 var issue = this.synchronizedJiraIssues[i];
                 var parameters = {};
                 ajaxPromises.push(new Promise(function(resolve, reject) {
                     jQuery.ajax({
                             "url": jiraUrl + issue.key + "/worklog",
                             "data": parameters,
                             "type": "GET",
                             "headers": oHeaders,
                             // make a sync call all 100 worklogs
                             // "async": !(i % 100 == 0)
                         }).done(function(data) {
                             retrievedWorklogs++;
                             var progressIndicator = me._oJiraLoadDialog.getContent()[0];
                             progressIndicator.setPercentValue((retrievedWorklogs) / total * 100);
                             progressIndicator.setDisplayValue((retrievedWorklogs) + " of " + total);
                             me.synchronizedJiraWorklog[issue.key] = data.worklogs;
                             console.log(retrievedWorklogs);
                             if (retrievedWorklogs % 100 == 0) {
                                 me._oJiraLoadDialog.rerender();
                                 console.log("After rerender: " +
                                     retrievedWorklogs);
                             }
                             resolve(data);
                         })
                         .fail(function(data) {
                             retrievedWorklogs++;
                             reject(data);
                             MessageToast.show("Failed to retrieve worklog");
                         });
                 }));

             }
             jQuery.sap.delayedCall(0, this, function() {
                Promise.all(ajaxPromises).then(function(data) {
                    MessageToast.show("All Worklogs loaded.");
                    window.localStorage.synchronizedJiraWorklog = LZString.compress(JSON.stringify(me.synchronizedJiraWorklog));
                    me._oJiraLoadDialog.close();
                }, function(data) {});
             });

         },
         onJiraConfigurationShow: function(oEvent, callback) {
             var oJiraConfigurationModel = new JSONModel({ "baseUrl": "", "username": "", "password": "" });
             if (window.localStorage.jiraConfiguration) {
                 oJiraConfigurationModel.setData(JSON.parse(window.localStorage.jiraConfiguration));
             }
             if (!this._oJiraConfigurationDialog) {
                 this._oJiraConfigurationDialog = sap.ui.xmlfragment("jirapivot.view.JiraConfigurationDialog", this);
                 this._oJiraConfigurationDialog.setModel(oJiraConfigurationModel);
                 this.getView().addDependent(this._oJiraConfigurationDialog);
             }
             this._oJiraConfigurationDialog.open();
             if (typeof callback == "function") {
                 this._oJiraConfigurationDialog.attachEventOnce("afterClose", function() {
                     callback();
                 });
             }
         },
         onJiraConfigurationConfirm: function() {
             window.localStorage.jiraConfiguration = JSON.stringify(this._oJiraConfigurationDialog.getModel().getData());
             this._oJiraConfigurationDialog.close();
         }
     });
 });