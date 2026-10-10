# SolMate: Search for Planetary Analogs (Twins on Earth/Sol 3 Ground)
**Team Northern Lights // NASA International Space Apps Challenge 2026**

SolMate is a full-stack planetary analog pipeline designed to validate life support systems and mission parameters by finding exact Earth-based environmental matches for off-world targets.

## Architecture
We built a decoupled, fault-tolerant POMDP (Partially Observable Markov Decision Process) architecture:
*   **Frontend:** Next.js & React (Hosted on GitHub Pages)
*   **Backend:** Django & Django REST Framework (Hosted on Render)
*   **Math Engine:** Python `numpy` for vectorized Spectral Angle Mapper scoring.
*   **Data Ingestion:** Live telemetry syncing via NASA's Open APIs.

## Fault-Tolerant Engineering
The Django API features graceful degradation. If NASA's endpoints experience downtime or rate limits, the backend automatically captures the `RequestException`, alerts the frontend dashboard, and injects simulated network variance into the `numpy` calculations to ensure uninterrupted mission planning.

##  Live Demo
*   **Dashboard:** [https://hellorifat.github.io/solmate](https://hellorifat.github.io/solmate)
*   **API Endpoint:** [https://solmate-api.onrender.com/api/v1/match/?target=jezero](https://solmate-api.onrender.com/api/v1/match/?target=jezero)
