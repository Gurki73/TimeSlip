class DateInput {
    constructor(container) {
      this.container = container;
      this.day10 = container.querySelector('#day10');
      this.day1 = container.querySelector('#day1');
      this.month = container.querySelector('#month');
      this.errorMessage = container.querySelector('#error-message');

      // Bind events
      this.day10.addEventListener('input', this.validateDate.bind(this));
      this.day1.addEventListener('input', this.validateDate.bind(this));
      this.month.addEventListener('change', this.validateDate.bind(this));
    }

    validateDate() {
      const day10Value = parseInt(this.day10.value || 0, 10);
      const day1Value = parseInt(this.day1.value || 0, 10);
      const monthValue = parseInt(this.month.value || 0, 10);
      const day = day10Value * 10 + day1Value;

      // Validate day and month
      const daysInMonth = this.getDaysInMonth(monthValue);
      if (monthValue === 0 || day < 1 || day > daysInMonth) {
        this.errorMessage.textContent = 'Invalid date';
        return false;
      }

      // Clear error message if valid
      this.errorMessage.textContent = '';
      return true;
    }

    getDaysInMonth(month) {
      switch (month) {
        case 2: return 29; // Assuming leap years are not handled.
        case 4: case 6: case 9: case 11: return 30;
        default: return 31;
      }
    }

    getValue() {
      const day10Value = parseInt(this.day10.value || 0, 10);
      const day1Value = parseInt(this.day1.value || 0, 10);
      const day = day10Value * 10 + day1Value;
      const month = parseInt(this.month.value || 0, 10);

      return { day, month };
    }
  }

  // Usage example
  const dateInput = new DateInput(document.querySelector('.date-input'));