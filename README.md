# Remote Education Toolkit

A collection of practical, browser-based tools designed to help educators manage remote and hybrid classrooms effectively. All tools work directly in the browser with no installation, accounts, or server setup required.

## Overview

The Remote Education Toolkit addresses common pain points in remote teaching by providing simple, self-contained tools that educators can open and use immediately. Each tool is a single HTML file with all functionality built in -- no external dependencies, no accounts, no data sent to any server.

## Tools

### Class Timer
A full-featured countdown timer for managing class activities, presentations, and break times.
- Set custom duration in minutes
- Large, visible countdown display
- Visual progress bar
- Audio alert when time expires (Web Audio API)
- Built-in break timer toggle
- Start, stop, and reset controls

### Attendance Tracker
A persistent attendance tracking system that works entirely in the browser.
- Add student names dynamically
- Mark attendance as Present, Absent, or Late
- Automatic attendance percentage calculation
- Date picker for historical records
- Export attendance data to CSV
- Data persists between sessions using localStorage

### Discussion Randomizer
A student participation tool for equitable classroom discussions.
- Add student names individually or in bulk
- Random student selection with visual animation
- Option to avoid picking the same student twice
- Group generator with customizable group sizes
- Clean, engaging interface

## Documentation

- `docs/remote-teaching-best-practices.md` - Comprehensive guide to effective remote teaching strategies

## Getting Started

1. Clone or download this repository
2. Open `index.html` in your browser for the toolkit landing page
3. Click on any tool to open it directly
4. Alternatively, open any tool's HTML file directly from the `tools/` folder

## Technical Details

- Pure HTML, CSS, and JavaScript
- No external dependencies or CDN requirements
- All data stays in the browser (localStorage)
- Works offline after initial page load
- Compatible with all modern browsers

## Privacy

All tools operate entirely client-side. No student data is ever transmitted to any server. Attendance data stored in localStorage remains on the educator's device and can be cleared at any time through browser settings.

## License

MIT License
