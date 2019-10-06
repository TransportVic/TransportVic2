#honestly wtf this should be using jsdom why tf isit in python idk lol

from bs4 import BeautifulSoup
from pathlib import Path
import os

for file_name in os.listdir('html-tables'):
    html = Path('html-tables/' + file_name).read_text()

    soup = BeautifulSoup(html, features='html5lib')
    table = soup.find("table", attrs={"class":"waffle"})
    table_body = table.find("tbody")

    csv_data = ""
    for row in table_body.find_all("tr"):
        dataset = []
        for td in row.find_all("td"):
            dataset.append('"' + td.get_text() + '"')
        csv_data += ','.join(dataset) + '\n'

    file = open('timetables/page-' + file_name[5:-5] + '.csv', 'w')
    file.write(csv_data)
    file.close()
