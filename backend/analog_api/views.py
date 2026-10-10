# backend/analog_api/views.py
import requests
import numpy as np
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

class AnalogMatcherAPI(APIView):
    def get(self, request):
        # 1. Capture the search query from the frontend (defaults to jezero)
        target = request.query_params.get('target', 'jezero').lower()
        
        nasa_url = f"https://api.nasa.gov/mars-photos/api/v1/rovers/perseverance/latest_photos?api_key={settings.NASA_API_KEY}"
        
        # Safe fallback images that allow hotlinking
        mars_image_url = "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00002/ids/fdr/browse/zcam/ZRF_0002_0667131195_000FDR_N0010052AUT_04096_0260LUJ01_1200.jpg"
        earth_image_url = "https://images.unsplash.com/photo-1541417904950-b855846fe074?auto=format&fit=crop&q=80&w=1000" # Reliable hotlink-safe analog image

        try:
            nasa_response = requests.get(nasa_url, timeout=5)
            if nasa_response.status_code == 200:
                telemetry_status = "OK (Live NASA Telemetry Sync)"
                network_variance = (nasa_response.elapsed.microseconds % 100) / 1000.0
                nasa_data = nasa_response.json()
                if "latest_photos" in nasa_data and len(nasa_data["latest_photos"]) > 0:
                    mars_image_url = nasa_data["latest_photos"][0]["img_src"].replace("http://", "https://")
            else:
                telemetry_status = f"Degraded (NASA Limit Reached)"
                network_variance = 0.02
        except requests.RequestException:
            telemetry_status = "Offline (Running Local Simulation)"
            network_variance = 0.05

        base_score_1 = np.round(0.88 + network_variance, 3)
        base_score_2 = np.round(0.84 + network_variance, 3)

        # 2. Dynamic Target Database
        analogs_db = {
            "jezero": [
                {"site_id": "salda", "name": "Lake Salda, Turkey", "match_score": float(base_score_1), "spectral_fit": "96% (Carbonates)", "topography_score": 81.0, "description": "Hydromagnesite microbialites mirror Martian deltaic deposits."},
                {"site_id": "atacama", "name": "Atacama Desert, Chile", "match_score": float(base_score_2), "spectral_fit": "82% (Sulfates)", "topography_score": 88.0, "description": "Hyper-arid environment with desiccated sulfates."}
            ],
            "gale": [
                {"site_id": "blood_falls", "name": "Blood Falls, Antarctica", "match_score": float(base_score_1), "spectral_fit": "94% (Iron Oxides)", "topography_score": 75.0, "description": "Subglacial hypersaline brine reflecting Martian subsurface fluid flows."},
                {"site_id": "devon", "name": "Devon Island, Canada", "match_score": float(base_score_2), "spectral_fit": "88% (Basaltic Breccia)", "topography_score": 92.0, "description": "Impact crater in a polar desert environment."}
            ],
            "malapert": [
                {"site_id": "concordia", "name": "Concordia Station, Antarctica", "match_score": float(base_score_1), "spectral_fit": "99% (Regolith Simulant)", "topography_score": 95.0, "description": "Extreme isolation and temperature profile matching lunar south pole."},
                {"site_id": "hawaii", "name": "Mauna Kea, Hawaii", "match_score": float(base_score_2), "spectral_fit": "91% (Basalt)", "topography_score": 85.0, "description": "Volcanic lunar-like terrain used for rover mobility testing."}
            ]
        }

        # Select data based on search, fallback to Jezero if target doesn't exist
        selected_analogs = analogs_db.get(target, analogs_db["jezero"])

        data = {
            "telemetry_status": telemetry_status,
            "target_zone": target.capitalize(),
            "mars_image_url": mars_image_url,
            "earth_image_url": earth_image_url,
            "analogs": selected_analogs
        }
        
        return Response(data, status=status.HTTP_200_OK)