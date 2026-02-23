# QUOP

QUOP, short for quantum optics, which I am developing to assist with my own work within the Macroscopic Quantum Optics lab at Aalto University. Hopefully it might be helpful to the greater community.

## Data Viewers

### CSV Viewer

A common format for oscilloscope data is csv, so I plan to develop a frontend interface which allows users to upload their own csv containing data (i.e. in the format of channel (V) against time (t)), removing the need to write some python/mathematica script every time just to do some sanity check.

#### Usage

### FITS Viewer

EMCCD camera data in our lab is saved in the [FITS](https://en.wikipedia.org/wiki/FITS) format, which is already commonly used within the astrophysics community. This format is used because it can be easily used in other languages (i.e. Mathematica's built-in import function can directly handle FITS file).

#### Usage
