#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <stdlib.h>
int main(int argc, char** argv)
{
    char destfile[200], tobesplitted[200], szv[100], sxv[100], syv[100], fulldestfile[500];
    char *psp;
    int zv, xv, yv;
    //get initial coord
    strcpy(destfile, argv[1]);
    sscanf(destfile, "v_%d_%d_%d", &zv, &xv, &yv);
    strcpy(fulldestfile, "/mnt/sdcard/tiles/");
    strcat(fulldestfile, destfile);
    //create 4 names
    char nw[100], sw[100], ne[100], se[100];
    nw[0] = '\0';
    sw[0] = '\0';
    ne[0] = '\0';
    se[0] = '\0';
    sprintf(nw, "/mnt/sdcard/tiles/v_%d_%d_%d", zv+1, xv*2, yv*2);
    sprintf(sw, "/mnt/sdcard/tiles/v_%d_%d_%d", zv+1, xv*2, yv*2+1);
    sprintf(ne, "/mnt/sdcard/tiles/v_%d_%d_%d", zv+1, xv*2+1, yv*2);
    sprintf(se, "/mnt/sdcard/tiles/v_%d_%d_%d", zv+1, xv*2+1, yv*2+1);
    //
    char combinecommand[500], uniquecommand[500], zoomcommand[500], formatcommand[500];
    char temp1[200], temp2[200], temp3[200], temp4[200];
    strcpy(temp1, "/mnt/sdcard/tiles/");
    strcpy(temp2, "/mnt/sdcard/tiles/");
    strcpy(temp3, "/mnt/sdcard/tiles/");
    strcpy(temp4, "/mnt/sdcard/tiles/");
    strcat(temp1, argv[1]);
    strcat(temp1, "_1");
    strcat(temp2, argv[1]);
    strcat(temp2, "_2");
    strcat(temp3, argv[1]);
    strcat(temp3, "_3");
    strcat(temp4, argv[1]);
    strcat(temp4, "_4");
    combinecommand[0] = '\0';
    strcpy(combinecommand, "jq -s '.[0].features + .[1].features + .[2].features + .[3].features' ");
    strcat(combinecommand, nw);
    strcat(combinecommand, " ");
    strcat(combinecommand, sw);
    strcat(combinecommand, " ");
    strcat(combinecommand, ne);
    strcat(combinecommand, " ");
    strcat(combinecommand, se);
    strcat(combinecommand, " > ");
    strcat(combinecommand, temp1);
    system(combinecommand);
    
    //start temp2
    uniquecommand[0] = '\0';
    strcpy(uniquecommand, "jq '. | unique_by(.properties.osm_id)' ");
    strcat(uniquecommand, temp1);
    strcat(uniquecommand, " > ");
    strcat(uniquecommand, temp2);
    system(uniquecommand);
    //start temp3
    zoomcommand[0] = '\0';
    char strzv[100];
    strcpy(zoomcommand, "jq '. | map(select(.properties.minzoom < ");
    sprintf(strzv, "%d", zv+1);
    strcat(zoomcommand, strzv);
    strcat(zoomcommand, "))' ");
    strcat(zoomcommand, temp2);
    strcat(zoomcommand, " > ");
    strcat(zoomcommand, temp3);
    system(zoomcommand);
    //start temp4
    FILE* gencontfile;
    gencontfile = fopen (temp4, "ab+");
    fputs("{\"crs\":{\"properties\":{\"name\":\"urn:ogc:def:crs:EPSG::4326\"},\"type\":\"name\"},\"features\":\n", gencontfile);    
    FILE* sourcefile;
    sourcefile = fopen(temp3, "r");
    char ch;
    int count = 0;
    fseek(sourcefile, 0L, SEEK_END);
    count = ftell(sourcefile);
    fseek(sourcefile, 0L, SEEK_SET);
    while(count--)
    {
        ch = fgetc(sourcefile);
        fputc(ch, gencontfile);
    }
    fclose(sourcefile);
    
    fputs(",\"totalFeatures\":", gencontfile);

    FILE *readoutput;
    char featurecommand[200], featureresult[100];
    featurecommand[0] = '\0';
    strcpy(featurecommand, "jq '. |length' ");
    strcat(featurecommand, temp2);
    if ((readoutput = popen(featurecommand, "r")) == NULL) {
        return -1;
    }

    while (fgets(featureresult, 100, readoutput) != NULL) {
        break;
    }

    if(pclose(readoutput))  {
        return -1;
    }
    fputs(featureresult, gencontfile);
    fputs(",\"type\":\"FeatureCollection\"}\n", gencontfile);
    fclose(gencontfile);


    //final file
    formatcommand[0] = '\0';
    strcpy(formatcommand, "jq -c '.' ");
    strcat(formatcommand, temp4);
    strcat(formatcommand, " > ");
    strcat(formatcommand, fulldestfile);
    system(formatcommand);
    
    //remove temp files
    char rmcomm1[200], rmcomm2[200], rmcomm3[200], rmcomm4[200];
    strcpy(rmcomm1, "rm ");
    strcpy(rmcomm2, "rm ");
    strcpy(rmcomm3, "rm ");
    strcpy(rmcomm4, "rm ");
    strcat(rmcomm1, temp1);
    strcat(rmcomm2, temp2);
    strcat(rmcomm3, temp3);
    strcat(rmcomm4, temp4);
    system(rmcomm1);
    system(rmcomm2);
    system(rmcomm3);
    system(rmcomm4);
}

