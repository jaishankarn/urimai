/* Practice portal, page 1: patterns common on older government forms. */
function copyAddress() {
  var doc = document.getElementById('AddressFrame').contentDocument;
  if (!doc) return;
  ['DoorNo', 'Street', 'Pincode'].forEach(function (id) {
    var el = doc.getElementById(id);
    if (el) document.getElementById('hdn' + id).value = el.value;
  });
}
function __doPostBack(target) {
  copyAddress();
  document.getElementById('__EVENTTARGET').value = target;
  document.getElementById('form1').submit();
}
function ageFrom(text) {
  var p = text.split('/');
  if (p.length !== 3) return '';
  var dob = new Date(+p[2], +p[1] - 1, +p[0]), now = new Date();
  var age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
  return String(age);
}
$(function () {
  $('#form1').on('submit', copyAddress);
  $('#DateOfBirth').datepicker({
    dateFormat: 'dd/mm/yy', changeMonth: true, changeYear: true, yearRange: '1920:2010', maxDate: 0,
    onSelect: function (text) { $('#Age').val(ageFrom(text)); }
  });
  $('#Community').select2({ width: '320px', placeholder: '-- Select --' });
  $('#ApplicantName, #HusbandName').on('input', function () {
    var pos = this.selectionStart; this.value = this.value.toUpperCase(); try { this.setSelectionRange(pos, pos); } catch (e) {}
  });
  $('#MobileNo, #AadhaarNo').on('keypress', function (e) { if (e.which && (e.which < 48 || e.which > 57)) e.preventDefault(); });
  $('#MobileNo').on('blur', function () {
    $('#MobileNoErr').text(!this.value || /^[6-9]\d{9}$/.test(this.value) ? '' : 'Enter a valid 10-digit mobile number.');
  });
});
