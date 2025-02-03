// JavaScript to handle the increase/decrease buttons and update the slider value
const decreaseBtn = document.getElementById('decrease-btn');
const increaseBtn = document.getElementById('increase-btn');
const sliderInput = document.getElementById('role-ratio-input');
const sliderFill = document.getElementById('slider-fill');

// Set initial value for the slider
let sliderValue = parseInt(sliderInput.value);

// Function to update the slider and fill bar
function updateSlider() {
  sliderInput.value = sliderValue;
  const percentage = (sliderValue / 100) * 100; // Convert value to percentage
  sliderFill.style.width = `${percentage}%`;
}

// Event listener for decrease button
decreaseBtn.addEventListener('click', function() {
  if (sliderValue > 0) {
    sliderValue -= 5;
    updateSlider();
  }
});

// Event listener for increase button
increaseBtn.addEventListener('click', function() {
  if (sliderValue < 100) {
    sliderValue += 5;
    updateSlider();
  }
});

// Update slider on input field change (optional, in case user edits the value directly)
sliderInput.addEventListener('input', function() {
  let value = parseInt(sliderInput.value);
  if (value >= 0 && value <= 100 && value % 5 === 0) {
    sliderValue = value;
    updateSlider();
  }
});
