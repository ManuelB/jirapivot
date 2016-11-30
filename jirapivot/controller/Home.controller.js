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
             this.synchronizedJiraWorklog = {};
             this.db = new Dexie("jirapivot");
             this.db.version(1).stores({
                 issues: 'key,id,self,issuetype,parent,timespent,project,fixVersions,customfield_10110,customfield_10111,aggregatetimespent,resolution,customfield_10310,customfield_10112,customfield_10113,customfield_10114,customfield_10104,customfield_10302,customfield_10105,customfield_10303,customfield_10501,customfield_10106,customfield_10304,customfield_10107,customfield_10305,customfield_10701,customfield_10108,customfield_10306,customfield_10702,customfield_10900,customfield_10109,customfield_10307,customfield_10901,customfield_10308,resolutiondate,customfield_10309,workratio,lastViewed,watches,created,priority,customfield_10100,customfield_10101,customfield_10300,customfield_10102,labels,customfield_10103,timeestimate,aggregatetimeoriginalestimate,versions,issuelinks,assignee,updated,status,components,timeoriginalestimate,description,customfield_10005,customfield_10401,customfield_10601,customfield_10602,customfield_10009,customfield_10603,aggregatetimeestimate,customfield_10604,summary,creator,subtasks,reporter,customfield_10000,aggregateprogress,customfield_10001,customfield_10004,customfield_10400,customfield_10115,environment,duedate,progress,votes',
                 worklogs: 'id,issueId,self,author,updateAuthor,comment,created,updated,started,timeSpent,timeSpentSeconds'
             });
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
                     data.issues.forEach(function(issue) {
                         me.db.issues.put(issue).catch(function(error) {
                             alert("Ooops: " + error);
                         });
                     });

                     var progressIndicator = me._oJiraLoadDialog.getContent()[0];
                     progressIndicator.setPercentValue((data.startAt + data.maxResults) / data.total * 100);
                     progressIndicator.setDisplayValue((data.startAt + data.maxResults) + " of " + data.total);

                     if (parameters.total === 0 || parameters.total <= parameters.startAt + parameters.maxResults) {
                         MessageToast.show("All JIRA issues loaded.");
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
                 // "Authorization": "Basic " + btoa(jiraConfiguration.username + ':' + jiraConfiguration.password)
                 // "Cookie": "JSESSIONID=A0A732DF81E05452D5CA34EEB546FF17"
             };

             var jiraUrl = jiraConfiguration.baseUrl + "/rest/api/2/issue/";
             if (!this._oJiraLoadDialog) {
                 this._oJiraLoadDialog = sap.ui.xmlfragment("jirapivot.view.JiraLoadDialog", this);
                 this.getView().addDependent(this._oJiraLoadDialog);
             }

             this._oJiraLoadDialog.open();
             var retrievedWorklogs = 0;

             var total = this.db.issues.count(function(total) {


                 var ajaxPromises = [];

                 me.db.issues.each(function(issue) {
                     var parameters = {};
                     ajaxPromises.push(new Promise(function(resolve, reject) {
                         jQuery.ajax({
                                 "url": jiraUrl + issue.key + "/worklog",
                                 "data": parameters,
                                 "type": "GET",
                                 "headers": oHeaders,
                                 xhrFields: {
                                     withCredentials: true
                                 },
                                 crossDomain: true
                                     // make a sync call all 100 worklogs
                                     // "async": !(i % 100 == 0)
                             }).done(function(data) {
                                 retrievedWorklogs++;
                                 var progressIndicator = me._oJiraLoadDialog.getContent()[0];
                                 progressIndicator.setPercentValue((retrievedWorklogs) / total * 100);
                                 progressIndicator.setDisplayValue((retrievedWorklogs) + " of " + total);
                                 data.worklogs.forEach(function(worklog) {
                                     me.db.worklogs.put(worklog);
                                 });
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

                 });
                 jQuery.sap.delayedCall(0, this, function() {
                     Promise.all(ajaxPromises).then(function(data) {
                         MessageToast.show("All Worklogs loaded.");
                         me._oJiraLoadDialog.close();
                     }, function(data) {});
                 });
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
         },
         onFillPivotTable: function() {
             var me = this;
             this.getView().setBusy(true);
             this.db.worklogs.toArray(function(worklogs) {
                 return Promise.all(worklogs.map(function(worklog) {
                     return me.db.issues.where("id").equals(worklog.issueId).first(function(issue) {

                         var assignee = {};
                         for (var prop in issue.fields.assignee) {
                             assignee["assigned" + prop] = issue.fields.assignee[prop];
                         }
                         var creator = {};
                         for (var prop in issue.fields.creator) {
                             creator["creator" + prop] = issue.fields.creator[prop];
                         }

                         return $.extend({}, /*issue.fields,*/ assignee, creator, { issuetype: issue.fields.issuetype.name, projectKey: issue.fields.project.key, status: issue.fields.status.name, epic: issue.fields.customfield_10005, worklogAuthor: worklog.author.displayName }, worklog);
                     });
                 }));
             }).then(function(results) {
                 me.byId("pivotTable").setData(results);
                 me.getView().setBusy(false);
             });
         }
     });
 });