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

    const NO_TAP_ERROR_MESSAGE = "You are not assigned to any TAPs. Please contact the person who gave you this app and ask them to assign you to a TAP.";

    $(function () {
        // New code - get PM's list of taps
        $('#loading').html(spinner + "Loading your validations...");

        microsoftTeams.getContext(function (context) {
            let email = context['userPrincipalName'];
            let apiEndpoint = '/api/pms/' + email + "/taps";
            ajaxRequest('GET', apiEndpoint, {}, function (data) {
                data = JSON.parse(data);
                let taps = data.taps;
                $('#validationContainer').show();
                $('#loading').hide();
                if (taps.length > 0) {
                    taps.forEach(function (tap) {
                        //button.btn.tapSelect#windows(style="float: right") WCCP
                        let tapButton = "<button class='btn tapSelect' id=" + tap + ">" + tap + "</button>";
                        $('#tapList').append(tapButton);
                    });
                } else {
                    //$('#tapList').text("You are not assigned to any TAPs.");
                    $('#validationContainer').text(NO_TAP_ERROR_MESSAGE);
                    $('#validationContainer').show();
                    $('#loading').hide();
                }

                // TODO: Build the table from these validations, setup JS events for them, etc
                let validations = data.validations;
                //console.log(validations);


                let alias = email.split("@")[0];

                $('#your-validations').find('.owner-' + alias).show();
                $('#other-validations').find('.owner-' + alias).hide();

                $('.tapSelect').click(function (e) {
                    console.log("Clicked tapSelect");
                    let id = $(this).attr('id')
                    console.log(id);

                    // Don't show client checkboxes in Windows validations
                    if (id == "Windows") {
                        console.log("Hiding client-config");
                        $('.client-config').hide();
                    } else {
                        console.log("Showing client-config");
                        $('.client-config').show();
                    }

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

                // Default to showing the first TAP
                $('#' + taps[0]).click();
            });
        });
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
            //columnDefs: [
            //    { width: "5%", "targets": 0 },
            //    { width: "10%", targets: 1 },
            //    { width: "85%", targets: 2 },
            //]
            //order: [[3, 'desc']],
        });

        microsoftTeams.getContext(function (context) {
            var alias = context["userPrincipalName"].split("@")[0];
        });


        $('.val').each(function (index) {
            var radio = $(this).find('[name="validation"');

            // Section list doesn't appear until you select this validatoin
            $(radio).click(function (e) {
                let sectionRow = $(radio).parents()[1];
                // Hide all the others
                $('.sections-table').hide();
                $('.sections-directions').hide();

                // Show this one
                $(sectionRow).find('.sections-table').show();
                $(sectionRow).find('.sections-directions').show();

                microsoftTeams.settings.setValidityState(true);
            })

            // Client select boxes don't appear until you click the group checkbox
            $(this).find('.group-toggle').change(function (e) {
                let sectionRow = $(this).parents()[2];

                if ($(this).is(':checked')) {
                    $(sectionRow).find('.client-config').show();
                } else {
                    $(sectionRow).find('.client-config').hide();
                }

                // Count the number of groups that are checked; don't save a validation with zero groups
                let sectionsTable = $(this).closest('.sections-table')
                let activeSections = sectionsTable.find('.group-toggle:checked').length;
                if (activeSections == 0) {
                    microsoftTeams.settings.setValidityState(false);
                    $(sectionsTable.parents()[0]).find('.zero-section-warning').show();
                } else {
                    microsoftTeams.settings.setValidityState(true);
                    $('.zero-section-warning').hide();
                }
            })


            $(this).find('.toggle-all').click(function (e) {
                let checked = this.checked;
                let sectionCell = $(this).parents()[2];
                var clientCheckboxes = $(sectionCell).find('.client').each(function (e) {
                    $(this).prop('checked', checked);
                })
            })

            let that = this;
            $(this).find('.client').change(function (e) {
                console.log("clicked");
                console.log(this);
                console.log(that);
                // TODO: Under that, find the checkbox with name="group" and check it if this is checked
            })


        })
    });

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