from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for, make_response
)

bp = Blueprint('zones', __name__, url_prefix='/zones')

@bp.route('/')
def dashboard():
  return render_template('base.html', title='Dashboard',
                       path='dashboard.html')

@bp.route('/settings')
def settings():
  return render_template('base.html', title='Zone Settings',
                       path='zone-settings.html')

@bp.route('/people-historical')
def people_historical():
  return render_template('base.html', title='People Historical',
                       path='zone-people-historical.html')

@bp.route('/people-hourly')
def people_hourly():
  return render_template('base.html', title='People Hourly',
                       path='zone-people-hourly-count.html')
