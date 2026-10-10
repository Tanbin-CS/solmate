# analog_api/models.py
from django.db import models

class PlanetaryTarget(models.Model):
    name = models.CharField(max_length=100)
    body = models.CharField(max_length=50) # Moon or Mars
    latitude = models.FloatField()
    longitude = models.FloatField()

    def __str__(self):
        return f"{self.name} ({self.body})"

class EarthAnalog(models.Model):
    target = models.ForeignKey(PlanetaryTarget, on_delete=models.CASCADE, related_name='analogs')
    name = models.CharField(max_length=150)
    match_score = models.FloatField()
    spectral_fit = models.CharField(max_length=100)
    topography_score = models.FloatField()
    description = models.TextField()

    def __str__(self):
        return self.name