const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.main-nav');

function closeMenu() {
  if (!menuButton || !menu) return;

  menuButton.classList.remove('active');
  menu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

menuButton?.addEventListener('click', () => {
  if (!menu) return;

  const isOpen = menu.classList.toggle('open');
  menuButton.classList.toggle('active', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('menu-open', isOpen);
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMenu);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 980) closeMenu();
});

const countdown = document.querySelector('.countdown');

if (countdown) {
  const targetDate = new Date(countdown.dataset.eventDate).getTime();
  const daysElement = countdown.querySelector('[data-days]');
  const hoursElement = countdown.querySelector('[data-hours]');
  const minutesElement = countdown.querySelector('[data-minutes]');
  const secondsElement = countdown.querySelector('[data-seconds]');

  const format = (value) => String(value).padStart(2, '0');

  function updateCountdown() {
    const distance = Math.max(0, targetDate - Date.now());
    const days = Math.floor(distance / 86400000);
    const hours = Math.floor((distance % 86400000) / 3600000);
    const minutes = Math.floor((distance % 3600000) / 60000);
    const seconds = Math.floor((distance % 60000) / 1000);

    if (daysElement) daysElement.textContent = format(days);
    if (hoursElement) hoursElement.textContent = format(hours);
    if (minutesElement) minutesElement.textContent = format(minutes);
    if (secondsElement) secondsElement.textContent = format(seconds);
  }

  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}

const revealElements = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('visible'));
}
