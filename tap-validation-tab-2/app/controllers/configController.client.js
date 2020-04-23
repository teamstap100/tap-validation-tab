'use strict';

(function () {

   // PRODUCTION
    //var contentUrlBase = "https://tap-validation-tab.azurewebsites.net/validations/";

    // TESTING
    //var contentUrlBase = "https://b915cf58.ngrok.io/validations/";

    console.log(window.location.href);
    var contentUrlBase = window.location.href.replace("config", "validations") + "/";

    // This doesn't work
    //var contentUrlBase = "../validations/";

    $(function () {
        var yourTable = $('#your-validations').DataTable({
            info: false,
            search: true,
            paging: false,
            //order: [[3, 'desc']],
        });

        var otherTable = $('#other-validations').DataTable({
            info: false,
            search: true,
            paging: false,
            //order: [[3, 'desc']],
        });

        microsoftTeams.getContext(function (context) {
            var alias = context["userPrincipalName"].split("@")[0];
            $('#your-validations').find('.owner-' + alias).show();
            $('#other-validations').find('.owner-' + alias).hide();
            
            $('.tapSelect').click(function (e) {
                let id = $(this).attr('id')
                console.log(id);

                // Hide other validations in your-validations
                $('#your-validations').find('.val').hide();

                // Show validations in your-validations where owner=alias and tap=id
                $('#your-validations').find('.owner-' + alias + '.tap-' + id).show();

                // Hide other validations in other-validations
                $('#other-validations').find('.val').hide();

                // Show validations in other-validations where tap=id
                $('#other-validations').find('.tap-' + id).show();

                // Hide validations in other-validations where owner=alias
                $('#other-validations').find('.owner-' + alias + '.tap-' + id).hide();

                $('.tapSelect').removeClass('active');
                $(this).addClass("active");
            });

            // TODO: Auto-click the correct one based on the alias. (Need to get PM objects from the server and check their TAP)
            // Oops. I am getting the PM objects but not sure how to get them from the server to this 
            $('#teams').click();
        });


        $('.val').each(function (index) {
            var radio = $(this).find('[name="validation"');

            // Section list doesn't appear until you select this validatoin
            $(radio).click(function (e) {
                console.log("Clicked a radio");
                let sectionRow = $(radio).parents()[1];
                console.log(sectionRow);
                console.log($(sectionRow).find('.sections-table'));
                // Hide all the others
                $('.sections-table').hide();

                // Show this one
                $(sectionRow).find('.sections-table').show();
            })


            $(this).find('.toggle-all').click(function (e) {
                let checked = this.checked;
                let sectionCell = $(this).parents()[2];
                var clientCheckboxes = $(sectionCell).find('.client').each(function (e) {
                    $(this).prop('checked', checked);
                })
            })


        })
    });

  function setValid() {
    console.log("onClick called");
    microsoftTeams.settings.setValidityState(true);
  }

  microsoftTeams.initialize();
  microsoftTeams.settings.registerOnSaveHandler(function(saveEvent){
      console.log("calling registerOnSaveHandler");

      let contentUrl = contentUrlBase;

      $(".val").each(function (index) {
          //console.log($(this));
          var radio = $(this).find('[name="validation"]');
          //console.log(radio);
          if (radio.is(':checked')) {
              contentUrl += radio[0].id;

              var groups = $(this).find('[name="group"]');
              var showVector = "";
              groups.each(function (ind2) {
                  if ($(this).is(':checked')) {
                      showVector += "1";
                  } else {
                      showVector += "0";
                  }
              })
              contentUrl += "&show=" + showVector;

              console.log("About to look at clientSettings");

              let clientsVector = "";
              var clientCheckboxes = $(this).find('[name="clients"]').each(function (e) {
                  let showThisClient = this.id.split("-")[2];
                  console.log(this.checked);
                  if (this.checked) {
                      clientsVector += "1";
                  } else {
                      clientsVector += "0";
                  }
              })


              contentUrl += "&clients=" + clientsVector;

              //var clientSignOff = $(this).find('[name="clients"]')[0];
              //if ($(clientSignOff).is(':checked')) {
              //    console.log("It's checked")
              //    contentUrl += "&clients=true"
              //}
              
              //console.log(showVector);
              //console.log(radio[0].value);
              //console.log(radio[0].id);

              var settings = {
                  entityId: radio[0].value,
                  contentUrl: contentUrl,
                  suggestedDisplayName: "V " + radio[0].value,
              }

              console.log(settings);
              microsoftTeams.settings.setSettings(settings);
          }
      });

      saveEvent.notifySuccess();
  });

})();