import { setOfficeStatus } from "../Components/calendar/calendar.js";

document.addEventListener('keydown', function (event) {
  if (!event.ctrlKey) {
    return
  }

  if (event.key === 'u') {
    event.preventDefault();
    // updateFeedback('Custom action for show Request-form');
    loadForm('request-form');
  }
  if (event.key === 'm') {
    event.preventDefault();
    loadForm('employee-form');
    // updateFeedback('Custom action for show employee-form');
  }
  if (event.key === 'w') {
    event.preventDefault();
    loadForm('admin-form');
    // updateFeedback('Custom action for show tools-form');
  }
  if (event.key === 'a') {
    event.preventDefault();
    loadForm('role-form');
    //updateFeedback('Custom action for show roles-form');
  }
  if (event.key === 'r') {
    event.preventDefault();
    loadForm('rule-form');
    // updateFeedback('Custom action for show Rule-form');
  }
  if (event.key === 'k') {
    event.preventDefault();
    loadForm('calendar-form');
    // updateFeedback('Custom action for show calendar-form');
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    // updateFeedback('Custom action for show in office view');
    setOfficeStatus('Anwesend')
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    // updateFeedback('Custom action for show out of office view');
    setOfficeStatus('Abwesend')
  }
});
