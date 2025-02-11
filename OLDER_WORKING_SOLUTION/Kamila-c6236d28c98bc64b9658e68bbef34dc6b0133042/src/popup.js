// Add import for MM manager
import './components/mm.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize tabs
  const tabs = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => {
        c.classList.remove('show', 'active');
      });

      // Add active class to clicked tab and corresponding content
      e.target.classList.add('active');
      const targetId = e.target.getAttribute('data-bs-target');
      document.querySelector(targetId).classList.add('show', 'active');
    });
  });

  // Remove DRWN content loading from MM tab
  const activeTab = document.querySelector('.nav-link.active');
  const targetId = activeTab.getAttribute('data-bs-target');
  if (targetId !== '#mm-tab') {
    loadDrwnContent();
  }
});

function loadDrwnContent() {
  const drwnContainer = document.getElementById('drwn-container');
  // Your existing DRWN loading logic here
} 