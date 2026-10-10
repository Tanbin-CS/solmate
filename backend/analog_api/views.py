# backend/analog_api/views.py
import requests
import numpy as np
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

class AnalogMatcherAPI(APIView):
    def get(self, request):
        target = request.query_params.get('target', 'jezero').lower()
        
        temp_weight = float(request.query_params.get('temp', 50)) / 100.0
        wind_weight = float(request.query_params.get('wind', 50)) / 100.0
        rad_weight = float(request.query_params.get('rad', 50)) / 100.0
        
        nasa_url = f"https://api.nasa.gov/mars-photos/api/v1/rovers/perseverance/latest_photos?api_key={settings.NASA_API_KEY}"
        mars_image_url = "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00002/ids/fdr/browse/zcam/ZRF_0002_0667131195_000FDR_N0010052AUT_04096_0260LUJ01_1200.jpg"
        earth_image_url = "https://images.unsplash.com/photo-1541417904950-b855846fe074?auto=format&fit=crop&q=80&w=1000"

        try:
            nasa_response = requests.get(nasa_url, timeout=5)
            if nasa_response.status_code == 200:
                telemetry_status = "OK (Live Multi-Agency Sync)"
                network_variance = (nasa_response.elapsed.microseconds % 100) / 1000.0
                nasa_data = nasa_response.json()
                if "latest_photos" in nasa_data and len(nasa_data["latest_photos"]) > 0:
                    mars_image_url = nasa_data["latest_photos"][0]["img_src"].replace("http://", "https://")
            else:
                telemetry_status = f"Degraded (Rate Limited)"
                network_variance = 0.02
        except requests.RequestException:
            telemetry_status = "Offline (Local Simulation)"
            network_variance = 0.05

        user_variance = (temp_weight * 0.05) + (wind_weight * -0.03) + (rad_weight * 0.04)
        base_score_1 = np.clip(np.round(0.88 + network_variance + user_variance, 3), 0.1, 0.99)
        base_score_2 = np.clip(np.round(0.81 + network_variance + (user_variance * 0.5), 3), 0.1, 0.99)

        # Expanded Database with Chart Parameters (0-100)
        analogs_db = {
            "jezero": [
                {"site_id": "salda", "name": "Lake Salda, Turkey", "match_score": base_score_1, "agency": "ESA Sentinel-2 / TUA", "spectral": 96, "topography": 81, "radiation": 42, "thermal": 70, "environment": "Hydromagnesite microbialites mirror Martian deltaic deposits."},
                {"site_id": "atacama", "name": "Atacama Desert, Chile", "match_score": base_score_2, "agency": "CONAE (Argentina)", "spectral": 82, "topography": 88, "radiation": 94, "thermal": 85, "environment": "Hyper-arid UV radiation analog."}
            ],
            "gale": [
                {"site_id": "blood_falls", "name": "Blood Falls, Antarctica", "match_score": base_score_1, "agency": "UKSA / NASA IceBridge", "spectral": 94, "topography": 75, "radiation": 30, "thermal": 92, "environment": "Subglacial hypersaline brine reflecting subsurface flows."},
                {"site_id": "devon", "name": "Devon Island, Canada", "match_score": base_score_2, "agency": "CSA (Canada)", "spectral": 88, "topography": 92, "radiation": 55, "thermal": 88, "environment": "Impact crater in a polar desert environment."}
            ],
            "malapert": [
                {"site_id": "concordia", "name": "Concordia Station, Antarctica", "match_score": base_score_1, "agency": "ESA / ASI (Italy)", "spectral": 99, "topography": 95, "radiation": 80, "thermal": 98, "environment": "Extreme thermal isolation (-80°C) matching lunar poles."},
                {"site_id": "hawaii", "name": "Mauna Kea, Hawaii", "match_score": base_score_2, "agency": "JAXA (Japan)", "spectral": 91, "topography": 85, "radiation": 88, "thermal": 60, "environment": "Volcanic lunar-like terrain for mobility testing."}
            ],
            "tycho": [
                {"site_id": "meteor_crater", "name": "Meteor Crater, USA", "match_score": base_score_1, "agency": "NASA Earth Observatory", "spectral": 85, "topography": 98, "radiation": 60, "thermal": 75, "environment": "Pristine impact crater morphology mimicking young lunar impacts."},
                {"site_id": "ries", "name": "Ries Crater, Germany", "match_score": base_score_2, "agency": "DLR (Germany)", "spectral": 92, "topography": 78, "radiation": 40, "thermal": 65, "environment": "Suevite breccia formations similar to lunar highlands."}
            ],
            "hellas": [
                {"site_id": "dry_valleys", "name": "McMurdo Dry Valleys, Antarctica", "match_score": base_score_1, "agency": "NSF / NASA", "spectral": 89, "topography": 84, "radiation": 75, "thermal": 96, "environment": "Ice-free hyper-arid polar desert resembling Martian plains."},
                {"site_id": "qaidam", "name": "Qaidam Basin, China", "match_score": base_score_2, "agency": "CNSA", "spectral": 95, "topography": 88, "radiation": 82, "thermal": 78, "environment": "High-altitude playa with polygonal desiccation cracks."}
            ],
            "artemis": [
                {"site_id": "lanzarote", "name": "Lanzarote, Spain", "match_score": base_score_1, "agency": "ESA PANGAEA / AEE", "spectral": 98, "topography": 90, "radiation": 70, "thermal": 65, "environment": "Basaltic lava tubes and fields used for astronaut training."},
                {"site_id": "askja", "name": "Askja Caldera, Iceland", "match_score": base_score_2, "agency": "NASA Apollo Archives", "spectral": 94, "topography": 85, "radiation": 45, "thermal": 80, "environment": "Pumice and ash fields historically used for Apollo lunar prep."}
            ]
        }

        selected_analogs = analogs_db.get(target, analogs_db["jezero"])

        data = {
            "telemetry_status": telemetry_status,
            "target_zone": target.capitalize(),
            "mars_image_url": mars_image_url,
            "earth_image_url": earth_image_url,
            "analogs": selected_analogs
        }
        
        return Response(data, status=status.HTTP_200_OK)