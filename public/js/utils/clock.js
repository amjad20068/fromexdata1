// Live Clock & Date Engine
export function initLiveClock() {
  const dateElements = document.querySelectorAll('[data-live-date]');
  const clockElements = document.querySelectorAll('[data-live-clock]');

  function update() {
    const now = new Date();

    // Format Date: "Wednesday, 16 September 2026"
    const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateString = now.toLocaleDateString('en-IN', optionsDate);

    // Format Time: "03:15:42 PM"
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const timeString = now.toLocaleTimeString('en-IN', optionsTime).toUpperCase();

    dateElements.forEach(el => {
      el.textContent = dateString;
    });

    clockElements.forEach(el => {
      el.textContent = timeString;
    });
  }

  // Initial call immediately
  update();
  // Update every second
  return setInterval(update, 1000);
}
