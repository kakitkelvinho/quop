# QUOP

A website which was built to support laboratory work at Macroscopic Quantum Optics (MQO) at Aalto University headed by Prof. Anton Zasedatelev. It is currently hosted as a github static website on [https://kitkatho.github.io/quop/](https://kitkatho.github.io/quop/). 

## Releases

Version 1.0.0 is live! the builder is usable and can be used to sketch out experimental setups, and all the plotters are also usable and have been tested roughly in the lab. Please report any issues if you encounter them! We are also always open to feedback, so also feel free to drop a line to us via email.

## Structure

It is currently divided into 4 sections:

### Experiment

This is currently populated by the `builder`, which allows users to build an experimental optical setup. There is a virtual optical table and users can drop individual optical components on the table.

### Theory

Coming soon.

### Calculators

Some simple I/Os to quickly calculate different physical concepts to help with back-of-the-envelope calculations. One easter egg calculator on running pace and speed because we are a sporty group :).

### Plotter

Our oscilloscope data are recorded primarily in `.csv`, and our spectrometer data is recorded in `.fits` files. Instead of writing python scripts every time or modifying mathematica notebooks to quickly check our data, we made this so we can quickly visualize the data we have recorded in the lab.

### Reporting problems

Found something broken or confusing? Use the "Report a problem" link in the footer or on any tool page. This lets you email me directly so I can address the problem.
