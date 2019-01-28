'use strict';

(function () {
   microsoftTeams.initialize();
   var newButton = document.querySelector('.btn-new-validation');

    var apiUrl = 'https://tap-validation-tab.azurewebsites.net//api/bugs';
    //var apiUrl = 'localhost:1337/api/bugs';

   newButton.addEventListener('click', function () {
      console.log("NewButton got clicked");

      //ajaxRequest('POST', apiUrl, function () {
      //   ajaxRequest('GET', apiUrl, updateValidationText)
      //});

   }, false);

   function ready (fn) {
      if (typeof fn !== 'function') {
         return;
      }

      if (document.readyState === 'complete') {
         return fn();
      }

      document.addEventListener('DOMContentLoaded', fn, false);
   }

   function ajaxRequest (method, url, callback) {
      var xmlhttp = new XMLHttpRequest();

      xmlhttp.onreadystatechange = function () {
         if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
            callback(xmlhttp.response);
         }
      };

      xmlhttp.open(method, url, true);
      xmlhttp.send();
   }

   //function updateClickCount (data) {
   //   var clicksObject = JSON.parse(data);
   //   clickNbr.innerHTML = clicksObject.clicks;
   //}

   function updateValidationText(data) {
      console.log("updateValidation called");
      validationText = "Validation submitted.";
   }

   ready(ajaxRequest('GET', apiUrl, updateValidationText));
})();